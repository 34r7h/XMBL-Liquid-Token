// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "../interfaces/IWormholeBridge.sol";

/**
 * @title MockIWormholeBridge
 * @dev Mock implementation of IWormholeBridge interface for testing
 */
contract MockIWormholeBridge is IWormholeBridge, ERC165 {
    mapping(bytes32 => TransferDetails) public transfers;
    mapping(bytes32 => bool) public completedTransfers;
    mapping(address => address) public wrappedTokens;
    uint256 public sequenceCounter = 1;
    
    event TransferCompleted(bytes32 indexed transferHash, address indexed recipient, uint256 amount);
    
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165) returns (bool) {
        return interfaceId == type(IWormholeBridge).interfaceId || super.supportsInterface(interfaceId);
    }
    
    function transferTokens(
        address token,
        uint256 amount,
        uint16 recipientChain,
        bytes32 recipient,
        uint256 arbiterFee,
        uint32 nonce
    ) external payable returns (uint64 sequence) {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Invalid amount");
        require(recipientChain > 0, "Invalid chain ID");
        require(recipient != bytes32(0), "Invalid recipient");
        
        bytes32 transferHash = keccak256(abi.encodePacked(
            token,
            amount,
            recipientChain,
            recipient,
            nonce,
            block.timestamp
        ));
        
        transfers[transferHash] = TransferDetails({
            payloadID: 1,
            amount: amount,
            tokenAddress: bytes32(uint256(uint160(token))),
            tokenChain: 2, // Ethereum
            to: recipient,
            toChain: recipientChain,
            fee: arbiterFee
        });
        
        sequence = uint64(sequenceCounter++);
        
        emit TransferInitiated(transferHash, token, amount, recipientChain, recipient);
    }
    
    function completeTransfer(bytes calldata encodedVM) external {
        require(encodedVM.length > 0, "Empty VAA");
        
        // Mock VAA parsing and validation
        bytes32 transferHash = keccak256(encodedVM);
        TransferDetails storage transfer = transfers[transferHash];
        
        require(transfer.amount > 0, "Transfer does not exist");
        require(!completedTransfers[transferHash], "Transfer already completed");
        
        completedTransfers[transferHash] = true;
        
        emit TransferCompleted(transferHash, address(uint160(uint256(transfer.to))), transfer.amount);
    }
    
    function parseTransfer(bytes calldata encoded) external pure returns (TransferDetails memory transfer) {
        require(encoded.length >= 32, "Invalid encoded data");
        
        // Mock parsing - return a valid transfer details structure
        transfer = TransferDetails({
            payloadID: 1,
            amount: 1000000,
            tokenAddress: bytes32(0),
            tokenChain: 2,
            to: bytes32(0),
            toChain: 1,
            fee: 0
        });
    }
    
    function attestToken(
        address token,
        uint32 nonce
    ) external payable returns (uint64 sequence) {
        require(token != address(0), "Invalid token address");
        
        bytes32 attestationId = keccak256(abi.encodePacked(token, nonce, block.timestamp));
        
        sequence = uint64(sequenceCounter++);
        
        emit TokenAttestation(token, 2, attestationId);
    }
    
    function createWrappedToken(
        uint16 tokenChain,
        bytes32 tokenAddress,
        uint8 decimals,
        string calldata symbol,
        string calldata name
    ) external returns (address token) {
        require(tokenChain > 0, "Invalid token chain");
        require(tokenAddress != bytes32(0), "Invalid token address");
        
        // Mock wrapped token creation
        token = address(uint160(uint256(tokenAddress)));
        wrappedTokens[token] = token;
        
        return token;
    }
    
    function getWrappedAsset(uint16 tokenChain, bytes32 tokenAddress) external view returns (address) {
        address wrappedToken = address(uint160(uint256(tokenAddress)));
        return wrappedTokens[wrappedToken];
    }
    
    function isTransferCompleted(bytes32 transferHash) external view returns (bool) {
        return completedTransfers[transferHash];
    }
    
    function calculateTransferFee(
        uint16 targetChain,
        uint256 amount
    ) external pure returns (uint256) {
        // Mock fee calculation
        return amount / 1000; // 0.1% fee
    }
    
    function createWrapped(bytes memory encodedVm) external returns (address) {
        // Mock wrapped token creation
        return address(uint160(uint256(keccak256(encodedVm))));
    }
    
    function updateWrapped(bytes memory encodedVm) external returns (address) {
        // Mock wrapped token update
        return address(uint160(uint256(keccak256(encodedVm))));
    }
    
    function wrapperForTokenOnChain(uint16 tokenChain, bytes32 tokenAddress) external view returns (address) {
        address wrappedToken = address(uint160(uint256(tokenAddress)));
        return wrappedTokens[wrappedToken];
    }
    
    function getGuardianInfo() external pure returns (uint256 guardianCount, uint256 quorum) {
        return (19, 13); // Mock guardian network info
    }
    
    function verifyVAA(bytes memory vaa) external view returns (bool) {
        // Mock VAA verification - always return true
        return vaa.length > 0;
    }
    
    function getBridgeFee(address token, uint256 amount, uint16 targetChain) external pure returns (uint256) {
        // Mock bridge fee calculation
        return amount / 1000; // 0.1% fee
    }
} 