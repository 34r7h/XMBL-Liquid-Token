// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Lock
 * @dev Hardhat-generated example contract for time-locked withdrawals
 * 
 * PURPOSE:
 * Default Hardhat template contract demonstrating basic Solidity patterns.
 * This contract can be used as reference or removed from production deployment.
 * Provides example of time-locked fund management and owner-based access control.
 * 
 * MAIN FUNCTIONS:
 * - constructor(uint _unlockTime) payable - Creates lock with specified unlock time
 * - withdraw() external - Withdraw funds after unlock time (owner only)
 * - getUnlockTime() external view returns (uint256) - Get unlock timestamp
 * - getBalance() external view returns (uint256) - Get contract balance
 * - getOwner() external view returns (address) - Get contract owner
 * - isUnlocked() external view returns (bool) - Check if unlock time has passed
 * 
 * STATE VARIABLES:
 * - uint256 public unlockTime - Timestamp when funds can be withdrawn
 * - address payable public owner - Owner who can withdraw funds
 * - bool public withdrawn - Flag to prevent multiple withdrawals
 * 
 * EVENTS:
 * - Withdrawal(uint amount, uint when) - Emitted when funds are withdrawn
 * - FundsLocked(uint amount, uint unlockTime, address owner) - Emitted on creation
 * 
 * REQUIREMENTS:
 * - Must accept ETH deposits during construction
 * - Must enforce time-lock mechanism
 * - Must restrict withdrawals to owner only
 * - Must prevent re-entrancy attacks
 * - Must emit events for transparency
 * 
 * USAGE PATTERNS:
 * - Time-locked savings accounts
 * - Escrow services with time delays
 * - Vesting schedules for tokens
 * - Emergency fund mechanisms
 * 
 * SECURITY FEATURES:
 * - Time-lock enforcement
 * - Owner-only access control
 * - Single withdrawal protection
 * - Event logging for audit trail
 * 
 * NOTE:
 * This is a Hardhat template contract and may not be needed for the XMBL protocol.
 * Consider removing from production deployment unless time-locked functionality is required.
 * 
 * CONNECTED SYSTEM COMPONENTS:
 * - None (standalone template contract)
 * - Can be removed or repurposed for protocol-specific time-lock needs
 */
contract Lock {
    uint256 public unlockTime;
    address payable public owner;
    bool public withdrawn;
    
    event Withdrawal(uint256 amount, uint256 when);
    event FundsLocked(uint256 amount, uint256 unlockTime, address owner);
    
    error UnlockTimeNotReached();
    error AlreadyWithdrawn();
    error NotOwner();
    error InvalidUnlockTime();
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
    
    modifier onlyAfterUnlock() {
        if (block.timestamp < unlockTime) revert UnlockTimeNotReached();
        _;
    }
    
    modifier onlyOnce() {
        if (withdrawn) revert AlreadyWithdrawn();
        _;
    }
    
    constructor(uint256 _unlockTime) payable {
        if (_unlockTime <= block.timestamp) revert InvalidUnlockTime();
        
        unlockTime = _unlockTime;
        owner = payable(msg.sender);
        withdrawn = false;
        
        emit FundsLocked(msg.value, _unlockTime, msg.sender);
    }
    
    function withdraw() external onlyOwner onlyAfterUnlock onlyOnce {
        uint256 amount = address(this).balance;
        withdrawn = true;
        
        (bool success, ) = owner.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawal(amount, block.timestamp);
    }
    
    function getUnlockTime() external view returns (uint256) {
        return unlockTime;
    }
    
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    function getOwner() external view returns (address) {
        return owner;
    }
    
    function isUnlocked() external view returns (bool) {
        return block.timestamp >= unlockTime;
    }
}