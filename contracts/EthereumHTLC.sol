// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EthereumHTLC is Ownable {
    event SwapLocked(
        bytes32 indexed swapId,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 amount,
        bytes32 hashLock,
        uint256 timelock
    );

    event SwapClaimed(bytes32 indexed swapId, bytes32 secret);
    event SwapRefunded(bytes32 indexed swapId);

    struct Swap {
        address sender;
        address recipient;
        address token;
        uint256 amount;
        bytes32 hashLock;
        uint256 timelock;
        bool claimed;
        bool refunded;
        bytes32 secret;
    }

    mapping(bytes32 => Swap) public swaps;

    // Lock tokens for a swap
    function lock(
        bytes32 swapId,
        address recipient,
        address token,
        uint256 amount,
        bytes32 hashLock,
        uint256 timelock
    ) external {
        require(swaps[swapId].sender == address(0), "Swap already exists");
        require(timelock > block.timestamp, "Timelock must be in the future");

        swaps[swapId] = Swap({
            sender: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            hashLock: hashLock,
            timelock: timelock,
            claimed: false,
            refunded: false,
            secret: 0x0
        });

        // Pull tokens from the sender
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        emit SwapLocked(swapId, msg.sender, recipient, token, amount, hashLock, timelock);
    }

    // Claim tokens with the secret
    function claim(bytes32 swapId, bytes32 secret) external {
        Swap storage swap = swaps[swapId];
        require(swap.sender != address(0), "Swap does not exist");
        require(!swap.claimed, "Swap already claimed");
        require(!swap.refunded, "Swap already refunded");
        require(swap.hashLock == sha256(abi.encodePacked(secret)), "Invalid secret");
        require(swap.timelock > block.timestamp, "Timelock expired");

        swap.claimed = true;
        swap.secret = secret;

        // Transfer tokens to the recipient
        IERC20(swap.token).transfer(swap.recipient, swap.amount);

        emit SwapClaimed(swapId, secret);
    }

    // Refund tokens after timelock expires
    function refund(bytes32 swapId) external {
        Swap storage swap = swaps[swapId];
        require(swap.sender != address(0), "Swap does not exist");
        require(!swap.claimed, "Swap already claimed");
        require(!swap.refunded, "Swap already refunded");
        require(swap.timelock <= block.timestamp, "Timelock not expired yet");

        swap.refunded = true;

        // Transfer tokens back to the sender
        IERC20(swap.token).transfer(swap.sender, swap.amount);

        emit SwapRefunded(swapId);
    }
}
