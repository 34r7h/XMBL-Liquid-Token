// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "../interfaces/I1inchFusion.sol";

/**
 * @title MockI1inchFusion
 * @dev Mock implementation of I1inchFusion interface for testing
 */
contract MockI1inchFusion is I1inchFusion, ERC165 {
    struct Order {
        address makerAsset;
        address takerAsset;
        uint256 makingAmount;
        uint256 takingAmount;
        address maker;
        bytes orderData;
        uint256 createdAt;
    }
    
    mapping(bytes32 => Order) public orders;
    mapping(bytes32 => bool) public cancelledOrders;
    mapping(bytes32 => uint256) public orderFills;
    
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165) returns (bool) {
        return interfaceId == type(I1inchFusion).interfaceId || super.supportsInterface(interfaceId);
    }
    
    function fillOrder(
        bytes calldata order,
        bytes calldata signature,
        uint256 makingAmount,
        uint256 takingAmount
    ) external returns (uint256 actualMakingAmount, uint256 actualTakingAmount) {
        bytes32 orderHash = keccak256(order);
        Order storage orderData = orders[orderHash];
        require(orderData.maker != address(0), "Order does not exist");
        require(!cancelledOrders[orderHash], "Order is cancelled");
        
        // Mock signature validation
        require(signature.length > 0, "Invalid signature");
        
        actualMakingAmount = makingAmount;
        actualTakingAmount = takingAmount;
        orderFills[orderHash] += makingAmount;
        
        emit OrderFilled(orderHash, orderData.maker, msg.sender, makingAmount, takingAmount);
    }
    
    function createOrder(
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount,
        bytes calldata orderData
    ) external returns (bytes32 orderHash) {
        require(makerAsset != address(0), "Invalid maker asset");
        require(takerAsset != address(0), "Invalid taker asset");
        require(makingAmount > 0, "Invalid making amount");
        require(takingAmount > 0, "Invalid taking amount");
        
        orderHash = keccak256(abi.encodePacked(
            makerAsset,
            takerAsset,
            makingAmount,
            takingAmount,
            orderData,
            block.timestamp,
            msg.sender
        ));
        
        orders[orderHash] = Order({
            makerAsset: makerAsset,
            takerAsset: takerAsset,
            makingAmount: makingAmount,
            takingAmount: takingAmount,
            maker: msg.sender,
            orderData: orderData,
            createdAt: block.timestamp
        });
        
        emit OrderCreated(orderHash, msg.sender, makerAsset, takerAsset);
    }
    
    function fillOrder(
        bytes32 orderHash,
        uint256 makingAmount,
        uint256 takingAmount,
        bytes calldata signature
    ) external returns (uint256) {
        Order storage order = orders[orderHash];
        require(order.maker != address(0), "Order does not exist");
        require(!cancelledOrders[orderHash], "Order is cancelled");
        require(makingAmount <= order.makingAmount, "Exceeds making amount");
        require(takingAmount <= order.takingAmount, "Exceeds taking amount");
        
        // Mock signature validation
        require(signature.length > 0, "Invalid signature");
        
        uint256 fillAmount = makingAmount;
        orderFills[orderHash] += fillAmount;
        
        emit OrderFilled(orderHash, order.maker, msg.sender, makingAmount, takingAmount);
        
        return fillAmount;
    }
    
    function cancelOrder(bytes32 orderHash) external {
        Order storage order = orders[orderHash];
        require(order.maker == msg.sender, "Not order maker");
        require(!cancelledOrders[orderHash], "Already cancelled");
        
        cancelledOrders[orderHash] = true;
        emit OrderCancelled(orderHash, msg.sender);
    }
    
    function getOrderStatus(bytes32 orderHash) external view returns (uint256) {
        if (orders[orderHash].maker == address(0)) {
            return 0; // NonExistent
        }
        if (cancelledOrders[orderHash]) {
            return 2; // Cancelled
        }
        if (orderFills[orderHash] >= orders[orderHash].makingAmount) {
            return 1; // Filled
        }
        return 0; // Active
    }
    
    function getOrderRemainingAmount(bytes32 orderHash) external view returns (uint256) {
        Order storage order = orders[orderHash];
        if (order.maker == address(0)) {
            return 0;
        }
        uint256 filled = orderFills[orderHash];
        return filled >= order.makingAmount ? 0 : order.makingAmount - filled;
    }
    
    function isValidSignature(bytes32 orderHash, bytes calldata signature) external pure returns (bool) {
        // Mock signature validation - always return true for testing
        return signature.length > 0;
    }
    
    function getOrderInfo(bytes32 orderHash) external view returns (
        address maker,
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 filledAmount
    ) {
        Order storage order = orders[orderHash];
        return (
            order.maker,
            order.makerAsset,
            order.takerAsset,
            order.makingAmount,
            order.takingAmount,
            orderFills[orderHash]
        );
    }
    
    function hashOrder(bytes calldata orderData) external pure returns (bytes32 orderHash) {
        return keccak256(orderData);
    }
    
    function getResolverInfo() external pure returns (uint256 resolverCount, uint256 averageResolutionTime) {
        return (10, 5); // Mock values
    }
} 