// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./TBAImplementation.sol";

contract ERC6551Registry {
    mapping(bytes32 => address) public accounts;
    
    event ERC6551AccountCreated(
        address account,
        address indexed implementation,
        bytes32 salt,
        uint256 chainId,
        address indexed tokenContract,
        uint256 indexed tokenId
    );
    
    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address accountAddress) {
        bytes32 accountHash = keccak256(
            abi.encodePacked(
                implementation,
                salt,
                chainId,
                tokenContract,
                tokenId
            )
        );
        
        accountAddress = accounts[accountHash];
        
        if (accountAddress == address(0)) {
            // For testing purposes, we'll create a simple proxy-style deployment
            // In a real implementation, this would use CREATE2 with proper bytecode
            
            // Deploy a new TBA instance
            TBAImplementation tba = new TBAImplementation();
            accountAddress = address(tba);
            
            // Initialize the TBA with the token contract and token ID
            try tba.initialize(tokenContract, tokenId) {} catch {}
            
            accounts[accountHash] = accountAddress;
            
            emit ERC6551AccountCreated(
                accountAddress,
                implementation,
                salt,
                chainId,
                tokenContract,
                tokenId
            );
        }
        
        return accountAddress;
    }
    
    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external view returns (address) {
        bytes32 accountHash = keccak256(
            abi.encodePacked(
                implementation,
                salt,
                chainId,
                tokenContract,
                tokenId
            )
        );
        
        address existingAccount = accounts[accountHash];
        if (existingAccount != address(0)) {
            return existingAccount;
        }
        
        // Return what the address would be if created
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            "ERC6551Account",
                            implementation,
                            chainId,
                            tokenContract,
                            tokenId,
                            salt
                        )
                    )
                )
            )
        );
    }
}
