// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../EthereumHTLC.sol";

/**
 * @title MaliciousReentrancy
 * @dev Mock contract to test reentrancy protection in EthereumHTLC
 */
contract MaliciousReentrancy {
    EthereumHTLC public htlc;
    bytes32 public secret;
    uint256 public attempts;
    
    constructor(address _htlc) {
        htlc = EthereumHTLC(_htlc);
    }
    
    function setupAttack(bytes32 _secret) external {
        secret = _secret;
        attempts = 0;
    }
    
    // This function should match what the test expects
    function attemptReentrancy(bytes32 hashlock, uint256 timelock) external payable {
        // First lock funds to setup the attack
        htlc.lockFunds{value: msg.value}(hashlock, timelock, address(this), msg.value);
        
        // Then try to claim (which should trigger reentrancy in receive())
        htlc.claimFunds(secret);
    }
    
    // Fallback function that attempts reentrancy
    receive() external payable {
        attempts++;
        if (attempts < 2) {
            // Try to claim again during the first claim - this should be blocked by reentrancy guard
            htlc.claimFunds(secret);
        }
    }
}
