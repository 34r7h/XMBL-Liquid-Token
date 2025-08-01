// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title EthereumHTLC
 * @dev Hash Time Locked Contract for atomic swaps between Ethereum and Bitcoin networks
 */
contract EthereumHTLC is Ownable, ERC165, ReentrancyGuard {
    
    struct SwapDetails {
        address initiator;
        address recipient;
        uint256 amount;
        address token; // ZeroAddress for ETH
        uint256 timelock;
        bool claimed;
        bool refunded;
        bytes32 secret;
    }
    
    // State variables
    mapping(bytes32 => SwapDetails) public swaps;
    mapping(address => uint256) public userActiveSwaps;
    uint256 public minimumTimelock = 3600; // 1 hour
    uint256 public maximumTimelock = 2592000; // 30 days
    uint256 public totalLockedValue;
    uint256 public completedSwaps;
    uint256 public refundedSwaps;
    bool public contractPaused;
    uint256 public maxActiveSwapsPerUser = 50; // Prevent griefing
    
    // Events
    event FundsLocked(bytes32 indexed hashlock, address indexed initiator, address indexed recipient, uint256 amount, uint256 timelock);
    event FundsClaimed(bytes32 indexed hashlock, address indexed claimer, bytes32 secret);
    event FundsRefunded(bytes32 indexed hashlock, address indexed initiator, uint256 amount);
    event SwapCancelled(bytes32 indexed hashlock, address indexed initiator);
    event TimelockExtended(bytes32 indexed hashlock, uint256 newTimelock);
    event ContractPaused(bool paused);
    
    modifier validHashlock(bytes32 hashlock) {
        require(hashlock != bytes32(0), "Invalid hashlock format");
        _;
    }
    
    modifier notPaused() {
        require(!contractPaused, "Contract is paused");
        _;
    }
    
    modifier validTimelock(uint256 timelock) {
        require(timelock > block.timestamp, "Timelock must be in the future");
        require(timelock <= block.timestamp + maximumTimelock && timelock > block.timestamp + minimumTimelock - 60, "Timelock duration invalid");
        _;
    }
    
    constructor() {
        _transferOwnership(msg.sender);
    }
    
    function lockFunds(
        bytes32 hashlock,
        uint256 timelock,
        address recipient,
        uint256 amount
    ) external payable notPaused validTimelock(timelock) validHashlock(hashlock) {
        require(swaps[hashlock].initiator == address(0), "Hashlock already exists");
        require(recipient != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than zero");
        require(recipient != address(this), "Cannot send to contract");
        require(userActiveSwaps[msg.sender] < maxActiveSwapsPerUser, "Too many active swaps");
        
        if (msg.value > 0) {
            require(msg.value == amount, "ETH amount mismatch");
            swaps[hashlock] = SwapDetails({
                initiator: msg.sender,
                recipient: recipient,
                amount: amount,
                token: address(0),
                timelock: timelock,
                claimed: false,
                refunded: false,
                secret: bytes32(0)
            });
        }
        
        userActiveSwaps[msg.sender]++;
        totalLockedValue += amount;
        
        emit FundsLocked(hashlock, msg.sender, recipient, amount, timelock);
    }
    
    function lockERC20Funds(
        bytes32 hashlock,
        uint256 timelock,
        address recipient,
        uint256 amount,
        address tokenAddress
    ) external notPaused validTimelock(timelock) validHashlock(hashlock) {
        require(swaps[hashlock].initiator == address(0), "Hashlock already exists");
        require(recipient != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than zero");
        require(tokenAddress != address(0), "Invalid token address");
        require(recipient != address(this), "Cannot send to contract");
        require(userActiveSwaps[msg.sender] < maxActiveSwapsPerUser, "Too many active swaps");
        
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        
        swaps[hashlock] = SwapDetails({
            initiator: msg.sender,
            recipient: recipient,
            amount: amount,
            token: tokenAddress,
            timelock: timelock,
            claimed: false,
            refunded: false,
            secret: bytes32(0)
        });
        
        userActiveSwaps[msg.sender]++;
        totalLockedValue += amount;
        
        emit FundsLocked(hashlock, msg.sender, recipient, amount, timelock);
    }
    
    function claimFunds(bytes32 secret) external nonReentrant {
        bytes32 hashlock = keccak256(abi.encodePacked(secret));
        SwapDetails storage swap = swaps[hashlock];
        
        require(swap.initiator != address(0), "Swap does not exist");
        require(!swap.claimed, "Already claimed or refunded");
        require(!swap.refunded, "Already claimed or refunded");
        require(block.timestamp <= swap.timelock, "Timelock expired");
        require(msg.sender == swap.recipient || msg.sender == swap.initiator, "Only recipient or initiator can claim");
        
        swap.claimed = true;
        swap.secret = secret;
        userActiveSwaps[swap.initiator]--;
        totalLockedValue -= swap.amount;
        completedSwaps++;
        
        // Determine who gets the funds based on who is claiming
        address recipient = (msg.sender == swap.initiator) ? swap.initiator : swap.recipient;
        
        if (swap.token == address(0)) {
            payable(recipient).transfer(swap.amount);
        } else {
            IERC20(swap.token).transfer(recipient, swap.amount);
        }
        
        emit FundsClaimed(hashlock, msg.sender, secret);
    }
    
    function refundFunds(bytes32 hashlock) external nonReentrant {
        SwapDetails storage swap = swaps[hashlock];
        
        require(swap.initiator != address(0), "Swap does not exist");
        require(!swap.claimed, "Already claimed or refunded");
        require(!swap.refunded, "Already claimed or refunded");
        require(block.timestamp > swap.timelock, "Timelock not expired");
        require(msg.sender == swap.initiator, "Only initiator can refund");
        
        swap.refunded = true;
        userActiveSwaps[swap.initiator]--;
        totalLockedValue -= swap.amount;
        refundedSwaps++;
        
        if (swap.token == address(0)) {
            payable(swap.initiator).transfer(swap.amount);
        } else {
            IERC20(swap.token).transfer(swap.initiator, swap.amount);
        }
        
        emit FundsRefunded(hashlock, swap.initiator, swap.amount);
    }
    
    function getSwapDetails(bytes32 hashlock) external view returns (SwapDetails memory) {
        return swaps[hashlock];
    }
    
    function isSwapActive(bytes32 hashlock) external view returns (bool) {
        SwapDetails memory swap = swaps[hashlock];
        return swap.initiator != address(0) && !swap.claimed && !swap.refunded;
    }
    
    function calculateHashlock(bytes32 secret) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(secret));
    }
    
    function extendTimelock(bytes32 hashlock, uint256 additionalTime) external {
        SwapDetails storage swap = swaps[hashlock];
        
        require(swap.initiator != address(0), "Swap does not exist");
        require(msg.sender == swap.initiator, "Not authorized to extend");
        require(!swap.claimed && !swap.refunded, "Swap already completed");
        require(swap.timelock + additionalTime <= block.timestamp + maximumTimelock, "Extension too long");
        
        swap.timelock += additionalTime;
        
        emit TimelockExtended(hashlock, swap.timelock);
    }
    
    function cancelSwap(bytes32 hashlock) external nonReentrant {
        SwapDetails storage swap = swaps[hashlock];
        
        require(swap.initiator != address(0), "Swap does not exist");
        require(msg.sender == swap.initiator, "Only initiator can cancel");
        require(!swap.claimed && !swap.refunded, "Cannot cancel claimed swap");
        require(block.timestamp <= swap.timelock, "Use refund after timelock");
        
        swap.refunded = true;
        userActiveSwaps[swap.initiator]--;
        totalLockedValue -= swap.amount;
        
        if (swap.token == address(0)) {
            payable(swap.initiator).transfer(swap.amount);
        } else {
            IERC20(swap.token).transfer(swap.initiator, swap.amount);
        }
        
        emit SwapCancelled(hashlock, swap.initiator);
    }
    
    function pauseContract() external onlyOwner {
        contractPaused = true;
        emit ContractPaused(contractPaused);
    }
    
    function unpauseContract() external onlyOwner {
        contractPaused = false;
        emit ContractPaused(contractPaused);
    }
    
    function setTimelockBounds(uint256 newMin, uint256 newMax) external onlyOwner {
        require(newMin > 0 && newMax > newMin, "Invalid timelock bounds");
        minimumTimelock = newMin;
        maximumTimelock = newMax;
    }
    
    function setMaxActiveSwapsPerUser(uint256 newMax) external onlyOwner {
        require(newMax > 0, "Invalid max active swaps");
        maxActiveSwapsPerUser = newMax;
    }
    
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
