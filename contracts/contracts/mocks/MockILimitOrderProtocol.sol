// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "../interfaces/ILimitOrderProtocol.sol";

/**
 * @title MockILimitOrderProtocol
 * @dev Mock implementation of ILimitOrderProtocol interface for testing
 */
contract MockILimitOrderProtocol is ILimitOrderProtocol, ERC165 {
    struct Order {
        uint256 salt;
        address makerAsset;
        address takerAsset;
        bytes makerAssetData;
        bytes takerAssetData;
        bytes getMakingAmount;
        bytes getTakingAmount;
        bytes predicate;
        bytes permit;
        bytes interaction;
    }
    
    mapping(bytes32 => Order) public orders;
    mapping(bytes32 => bool) public cancelledOrders;
    mapping(bytes32 => uint256) public orderFills;
    mapping(bytes32 => uint256) public invalidatorBitmap;
    
    event OrderFilled(bytes32 indexed orderHash, address indexed taker, uint256 makingAmount, uint256 takingAmount);
    event OrderCancelled(bytes32 indexed orderHash, address indexed maker);
    
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165) returns (bool) {
        return interfaceId == type(ILimitOrderProtocol).interfaceId || super.supportsInterface(interfaceId);
    }
    
    function fillOrder(
        LimitOrder calldata order,
        bytes calldata signature,
        uint256 makingAmount,
        uint256 takingAmount
    ) external returns (uint256 actualMakingAmount, uint256 actualTakingAmount) {
        bytes32 orderHash = getOrderHash(order);
        require(orders[orderHash].salt != 0, "Order does not exist");
        require(!cancelledOrders[orderHash], "Order is cancelled");
        
        // Mock signature validation
        require(signature.length > 0, "Invalid signature");
        
        actualMakingAmount = makingAmount;
        actualTakingAmount = takingAmount;
        orderFills[orderHash] += makingAmount;
        
        emit OrderFilled(msg.sender, orderHash, 1000000 - orderFills[orderHash]);
        
        return (actualMakingAmount, actualTakingAmount);
    }
    
    function fillOrderRFQ(
        LimitOrder calldata order,
        bytes calldata signature,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 threshold
    ) external returns (uint256) {
        bytes32 orderHash = getOrderHash(order);
        require(orders[orderHash].salt != 0, "Order does not exist");
        require(!cancelledOrders[orderHash], "Order is cancelled");
        
        // Mock signature validation
        require(signature.length > 0, "Invalid signature");
        
        uint256 fillAmount = makingAmount;
        orderFills[orderHash] += fillAmount;
        
        emit OrderFilled(orderHash, msg.sender, makingAmount, takingAmount);
        
        return fillAmount;
    }
    
    function cancelOrder(LimitOrder calldata order) external {
        bytes32 orderHash = getOrderHash(order);
        require(orders[orderHash].salt != 0, "Order does not exist");
        require(!cancelledOrders[orderHash], "Already cancelled");
        
        cancelledOrders[orderHash] = true;
        emit OrderCancelled(orderHash, msg.sender);
    }
    
    function invalidateOrder(bytes32 orderHash) external {
        require(orders[orderHash].salt != 0, "Order does not exist");
        invalidatorBitmap[orderHash] = 1;
    }
    
    function getOrderHash(LimitOrder calldata order) public pure returns (bytes32) {
        return keccak256(abi.encode(
            order.salt,
            order.makerAsset,
            order.takerAsset,
            order.makerAssetData,
            order.takerAssetData,
            order.getMakingAmount,
            order.getTakingAmount,
            order.predicate,
            order.permit,
            order.interaction
        ));
    }
    
    function simulate(
        address target,
        bytes calldata data
    ) external {
        // Mock simulation - do nothing
    }
    
    function simulateCall(
        address target,
        bytes calldata data
    ) external view returns (uint256) {
        // Mock simulation - return a reasonable gas estimate
        return 100000;
    }
    
    function simulateCallWithGas(
        address target,
        bytes calldata data,
        uint256 gasLimit
    ) external view returns (uint256) {
        // Mock simulation - return the provided gas limit
        return gasLimit;
    }
    
    function checkPredicate(LimitOrder calldata order) external view returns (bool) {
        // Mock predicate check - always return true
        return true;
    }
    
    function remaining(bytes32 orderHash) external view returns (uint256) {
        Order storage order = orders[orderHash];
        if (order.salt == 0) {
            return 0;
        }
        uint256 filled = orderFills[orderHash];
        // Mock remaining amount calculation
        return filled >= 1000000 ? 0 : 1000000 - filled;
    }
    
    function invalidatorForOrderRFQ(address maker, uint256 slot) external view returns (uint256) {
        // Mock invalidator - return a default value
        return 0;
    }
    
    function isValidSignature(LimitOrder calldata order, bytes calldata signature) external view returns (bool) {
        // Mock signature validation - always return true
        return signature.length > 0;
    }
    
    function getOrderStatus(bytes32 orderHash) external view returns (uint256) {
        if (orders[orderHash].salt == 0) {
            return 0; // NonExistent
        }
        if (cancelledOrders[orderHash]) {
            return 2; // Cancelled
        }
        if (orderFills[orderHash] >= 1000000) { // Mock threshold
            return 1; // Filled
        }
        return 0; // Active
    }
    
    function hashOrder(LimitOrder calldata order) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(order.salt, order.makerAsset, order.takerAsset));
    }
} 