// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EthereumHTLC {
    event SwapLocked(
        bytes32 indexed lockId,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 amount,
        bytes32 hashedSecret,
        uint256 expiration
    );

    event SwapClaimed(bytes32 indexed lockId, bytes32 secret);
    event SwapRefunded(bytes32 indexed lockId);

    struct Lock {
        address sender;
        address recipient;
        address token;
        uint256 amount;
        bytes32 hashedSecret;
        uint256 expiration;
        bool claimed;
        bool refunded;
    }

    mapping(bytes32 => Lock) public locks;

    function lock(
        bytes32 lockId,
        address recipient,
        address token,
        uint256 amount,
        bytes32 hashedSecret,
        uint256 expiration
    ) external {
        require(locks[lockId].sender == address(0), "Lock already exists");
        require(expiration > block.timestamp, "Expiration must be in the future");

        IERC20(token).transferFrom(msg.sender, address(this), amount);

        locks[lockId] = Lock({
            sender: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            hashedSecret: hashedSecret,
            expiration: expiration,
            claimed: false,
            refunded: false
        });

        emit SwapLocked(lockId, msg.sender, recipient, token, amount, hashedSecret, expiration);
    }

    function claim(bytes32 lockId, bytes32 secret) external {
        Lock storage l = locks[lockId];
        require(l.sender != address(0), "Lock does not exist");
        require(!l.claimed, "Already claimed");
        require(!l.refunded, "Already refunded");
        require(l.hashedSecret == sha256(abi.encodePacked(secret)), "Invalid secret");

        l.claimed = true;
        IERC20(l.token).transfer(l.recipient, l.amount);

        emit SwapClaimed(lockId, secret);
    }

    function refund(bytes32 lockId) external {
        Lock storage l = locks[lockId];
        require(l.sender != address(0), "Lock does not exist");
        require(!l.claimed, "Already claimed");
        require(!l.refunded, "Already refunded");
        require(block.timestamp >= l.expiration, "Not yet expired");

        l.refunded = true;
        IERC20(l.token).transfer(l.sender, l.amount);

        emit SwapRefunded(lockId);
    }
}
