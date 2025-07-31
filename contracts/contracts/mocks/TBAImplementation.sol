// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

contract TBAImplementation is IERC165 {
    mapping(bytes4 => bool) private _supportedInterfaces;
    mapping(address => uint256) public nonces;
    
    address public owner;
    bool public initialized;
    
    event TransactionExecuted(address indexed target, uint256 value, bytes data);
    
    constructor() {
        // Register supported interfaces
        _supportedInterfaces[type(IERC165).interfaceId] = true;
        _supportedInterfaces[0x6faff5f1] = true; // ERC6551Account interface
    }
    
    function initialize(address _owner) external {
        require(!initialized, "TBA: Already initialized");
        owner = _owner;
        initialized = true;
    }
    
    function executeCall(
        address target,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory result) {
        require(msg.sender == owner, "TBA: Only owner can execute");
        require(target != address(0), "TBA: Invalid target");
        
        nonces[msg.sender]++;
        
        (bool success, bytes memory returnData) = target.call{value: value}(data);
        require(success, "TBA: Call failed");
        
        emit TransactionExecuted(target, value, data);
        return returnData;
    }
    
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId) {
        // Mock implementation - in real ERC-6551, this would be extracted from the account address
        return (block.chainid, address(this), 1);
    }
    
    function state() external view returns (uint256) {
        return nonces[owner];
    }
    
    function isValidSigner(address signer, bytes calldata) external view returns (bytes4) {
        if (signer == owner) {
            return 0x1626ba7e; // ERC-1271 magic value
        }
        return 0xffffffff;
    }
    
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return _supportedInterfaces[interfaceId];
    }
    
    receive() external payable {}
    
    fallback() external payable {}
}
