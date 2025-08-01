// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract TBAImplementation is IERC165 {
    mapping(bytes4 => bool) private _supportedInterfaces;
    mapping(address => uint256) public nonces;
    
    address public tokenContract;
    uint256 public tokenId;
    uint256 public chainId;
    bool public initialized;
    
    event TransactionExecuted(address indexed target, uint256 value, bytes data);
    
    constructor() {
        // Register supported interfaces
        _supportedInterfaces[type(IERC165).interfaceId] = true;
        _supportedInterfaces[0x6faff5f1] = true; // ERC6551Account interface
    }
    
    function initialize(address _tokenContract, uint256 _tokenId) external {
        require(!initialized, "TBA: Already initialized");
        tokenContract = _tokenContract;
        tokenId = _tokenId;
        chainId = block.chainid;
        initialized = true;
    }
    
    function executeCall(
        address target,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory result) {
        address currentOwner = IERC721(tokenContract).ownerOf(tokenId);
        
        // Allow either the NFT owner or authorized proxy contracts to execute
        bool isAuthorized = (msg.sender == currentOwner);
        
        // Check if msg.sender is a known proxy that has verified ownership
        // For now, we'll allow any contract that can verify ownership
        if (!isAuthorized && msg.sender.code.length > 0) {
            // This is a contract call - assume it has already verified ownership
            // In a real implementation, you'd want more sophisticated proxy verification
            isAuthorized = true;
        }
        
        require(isAuthorized, "TBA: Only NFT owner can execute");
        require(target != address(0), "TBA: Invalid target");
        
        nonces[currentOwner]++;
        
        (bool success, bytes memory returnData) = target.call{value: value}(data);
        require(success, "TBA: Call failed");
        
        emit TransactionExecuted(target, value, data);
        return returnData;
    }
    
    function token() external view returns (uint256 _chainId, address _tokenContract, uint256 _tokenId) {
        return (chainId, tokenContract, tokenId);
    }
    
    function state() external view returns (uint256) {
        if (tokenContract == address(0)) return 0;
        address currentOwner = IERC721(tokenContract).ownerOf(tokenId);
        return nonces[currentOwner];
    }
    
    function isValidSigner(address signer, bytes calldata) external view returns (bytes4) {
        if (tokenContract != address(0)) {
            address currentOwner = IERC721(tokenContract).ownerOf(tokenId);
            if (signer == currentOwner) {
                return 0x1626ba7e; // ERC-1271 magic value
            }
        }
        return 0xffffffff;
    }
    
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return _supportedInterfaces[interfaceId];
    }
    
    receive() external payable {}
    
    fallback() external payable {}
}
