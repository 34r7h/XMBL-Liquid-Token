// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title YieldManager
 * @dev Contract responsible for deploying WBTC to yield protocols and harvesting yield for distribution
 */
contract YieldManager is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // State variables
    IERC20 public immutable wbtcToken;
    address public vaultContract;
    uint256 public totalDeployed;
    uint256 public totalYieldHarvested;
    uint256 public lastHarvestTime;
    uint256 public rebalanceThreshold = 1000; // 10% threshold for rebalancing

    // Protocol management
    mapping(address => uint256) public protocolBalances;
    mapping(address => uint256) public accruedYield;
    mapping(address => bool) public enabledProtocols;
    address[] public activeProtocols;

    // Structs
    struct YieldPosition {
        address protocol;
        uint256 balance;
        uint256 yield;
        string apy;
    }

    // Events
    event FundsDeployed(address indexed protocol, uint256 amount, uint256 timestamp);
    event YieldHarvested(address indexed protocol, uint256 amount, uint256 timestamp);
    event FundsWithdrawn(address indexed protocol, uint256 amount, uint256 timestamp);
    event PositionsRebalanced(uint256 totalMoved, uint256 timestamp);
    event ProtocolStatusChanged(address indexed protocol, bool enabled);
    event EmergencyWithdrawal(address indexed protocol, uint256 amount);

    // Modifiers
    modifier onlyVault() {
        require(msg.sender == vaultContract, "Only vault can call this function");
        _;
    }

    modifier validProtocol(address protocol) {
        require(protocol != address(0), "Invalid protocol address");
        _;
    }

    modifier validAmount(uint256 amount) {
        require(amount > 0, "Amount must be greater than zero");
        _;
    }

    constructor(address _wbtcToken) {
        wbtcToken = IERC20(_wbtcToken);
        rebalanceThreshold = 1000; // 10%
    }

    // Vault management
    function setVaultContract(address _vaultContract) external onlyOwner {
        vaultContract = _vaultContract;
    }

    // Protocol management
    function setYieldProtocol(address protocol, bool enabled) external onlyOwner validProtocol(protocol) {
        bool wasEnabled = enabledProtocols[protocol];
        enabledProtocols[protocol] = enabled;

        if (enabled && !wasEnabled) {
            // Add to active protocols
            activeProtocols.push(protocol);
        } else if (!enabled && wasEnabled) {
            // Remove from active protocols
            for (uint256 i = 0; i < activeProtocols.length; i++) {
                if (activeProtocols[i] == protocol) {
                    activeProtocols[i] = activeProtocols[activeProtocols.length - 1];
                    activeProtocols.pop();
                    break;
                }
            }
        }

        emit ProtocolStatusChanged(protocol, enabled);
    }

    // Fund deployment
    function deployFunds(address protocol, uint256 amount) 
        external 
        onlyVault 
        nonReentrant 
        whenNotPaused 
        validAmount(amount) 
    {
        require(enabledProtocols[protocol], "Protocol not enabled");

        // Transfer WBTC from vault to this contract
        wbtcToken.safeTransferFrom(vaultContract, address(this), amount);

        // Approve and deposit to protocol
        wbtcToken.safeApprove(protocol, amount);
        
        // Call protocol's deposit function
        (bool success, ) = protocol.call(
            abi.encodeWithSignature("deposit(address,uint256)", address(wbtcToken), amount)
        );
        require(success, "Protocol deposit failed");

        // Update balances
        protocolBalances[protocol] += amount;
        totalDeployed += amount;

        emit FundsDeployed(protocol, amount, block.timestamp);
    }

    // Fund withdrawal
    function withdrawFunds(address protocol, uint256 amount) 
        external 
        onlyVault 
        nonReentrant 
        validAmount(amount) 
    {
        require(protocolBalances[protocol] >= amount, "Insufficient balance");

        // Call protocol's withdraw function
        (bool success, ) = protocol.call(
            abi.encodeWithSignature("withdraw(address,uint256)", address(wbtcToken), amount)
        );
        require(success, "Protocol withdrawal failed");

        // Update balances
        protocolBalances[protocol] -= amount;
        totalDeployed -= amount;

        // Transfer WBTC back to vault
        wbtcToken.safeTransfer(vaultContract, amount);

        emit FundsWithdrawn(protocol, amount, block.timestamp);
    }

    // Yield harvesting
    function harvestYield() external nonReentrant returns (uint256 totalHarvested) {
        uint256 initialBalance = wbtcToken.balanceOf(address(this));

        for (uint256 i = 0; i < activeProtocols.length; i++) {
            address protocol = activeProtocols[i];
            
            // Get yield from protocol
            (bool success, bytes memory data) = protocol.call(
                abi.encodeWithSignature("harvestYield()")
            );
            
            if (success && data.length > 0) {
                uint256 yield = abi.decode(data, (uint256));
                if (yield > 0) {
                    accruedYield[protocol] += yield;
                    totalHarvested += yield;
                    emit YieldHarvested(protocol, yield, block.timestamp);
                }
            }
        }

        // Update total yield harvested
        totalYieldHarvested += totalHarvested;
        lastHarvestTime = block.timestamp;

        // Transfer any harvested tokens to vault
        uint256 finalBalance = wbtcToken.balanceOf(address(this));
        if (finalBalance > initialBalance) {
            uint256 harvestedAmount = finalBalance - initialBalance;
            wbtcToken.safeTransfer(vaultContract, harvestedAmount);
        }

        return totalHarvested;
    }

    // Position rebalancing
    function rebalancePositions() external onlyOwner nonReentrant {
        uint256 totalMoved = 0;
        uint256 numProtocols = activeProtocols.length;
        
        if (numProtocols <= 1) {
            emit PositionsRebalanced(0, block.timestamp);
            return;
        }

        // Simple rebalancing: try to distribute evenly
        uint256 targetBalance = totalDeployed / numProtocols;
        
        // Find protocols with excess funds
        for (uint256 i = 0; i < numProtocols; i++) {
            address fromProtocol = activeProtocols[i];
            uint256 excess = 0;
            
            if (protocolBalances[fromProtocol] > targetBalance) {
                excess = protocolBalances[fromProtocol] - targetBalance;
                
                // Find protocols needing funds
                for (uint256 j = 0; j < numProtocols; j++) {
                    address toProtocol = activeProtocols[j];
                    
                    if (protocolBalances[toProtocol] < targetBalance && excess > 0) {
                        uint256 needed = targetBalance - protocolBalances[toProtocol];
                        uint256 moveAmount = excess < needed ? excess : needed;
                        
                        if (moveAmount > 0) {
                            // Withdraw from source protocol
                            (bool success1, ) = fromProtocol.call(
                                abi.encodeWithSignature("withdraw(address,uint256)", address(wbtcToken), moveAmount)
                            );
                            
                            if (success1) {
                                // Deposit to target protocol
                                wbtcToken.safeApprove(toProtocol, moveAmount);
                                (bool success2, ) = toProtocol.call(
                                    abi.encodeWithSignature("deposit(address,uint256)", address(wbtcToken), moveAmount)
                                );
                                
                                if (success2) {
                                    protocolBalances[fromProtocol] -= moveAmount;
                                    protocolBalances[toProtocol] += moveAmount;
                                    totalMoved += moveAmount;
                                    excess -= moveAmount;
                                }
                            }
                        }
                    }
                }
            }
        }

        emit PositionsRebalanced(totalMoved, block.timestamp);
    }

    // Emergency functions
    function emergencyWithdraw(address protocol) external onlyOwner nonReentrant {
        uint256 balance = protocolBalances[protocol];
        if (balance > 0) {
            // Try to withdraw from protocol
            (bool success, ) = protocol.call(
                abi.encodeWithSignature("withdraw(address,uint256)", address(wbtcToken), balance)
            );
            
            if (success) {
                protocolBalances[protocol] = 0;
                totalDeployed -= balance;
                
                // Transfer back to vault
                wbtcToken.safeTransfer(vaultContract, balance);
                
                emit EmergencyWithdrawal(protocol, balance);
            }
        }
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // View functions
    function getActiveProtocols() external view returns (address[] memory) {
        return activeProtocols;
    }

    function getActivePositions() external view returns (YieldPosition[] memory) {
        YieldPosition[] memory positions = new YieldPosition[](activeProtocols.length);
        
        for (uint256 i = 0; i < activeProtocols.length; i++) {
            address protocol = activeProtocols[i];
            
            // Get APY from protocol
            string memory apy = "0";
            (bool success, bytes memory data) = protocol.staticcall(
                abi.encodeWithSignature("apy()")
            );
            if (success && data.length > 0) {
                apy = abi.decode(data, (string));
            }
            
            positions[i] = YieldPosition({
                protocol: protocol,
                balance: protocolBalances[protocol],
                yield: accruedYield[protocol],
                apy: apy
            });
        }
        
        return positions;
    }

    function getTotalYield() external view returns (uint256 total) {
        // Start with already harvested yield
        total = totalYieldHarvested;
        
        for (uint256 i = 0; i < activeProtocols.length; i++) {
            address protocol = activeProtocols[i];
            
            // Get current yield from protocol
            (bool success, bytes memory data) = protocol.staticcall(
                abi.encodeWithSignature("getYield()")
            );
            if (success && data.length > 0) {
                uint256 currentYield = abi.decode(data, (uint256));
                total += currentYield;
            }
            
            // Add accrued yield
            total += accruedYield[protocol];
        }
    }
}
