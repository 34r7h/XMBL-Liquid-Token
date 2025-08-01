// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ILimitOrderProtocol
 * @dev Interface for 1inch Limit Order Protocol contract interactions
 * 
 * PURPOSE:
 * Defines interface for 1inch Limit Order Protocol, enabling creation and execution
 * of limit orders with advanced features like conditional execution and automation.
 * 
 * MAIN FUNCTIONS:
 * - fillOrder(LimitOrder calldata order, bytes calldata signature, uint256 makingAmount, uint256 takingAmount) external returns (uint256, uint256)
 *   * Fills a limit order partially or completely
 *   * Arguments: order struct, maker signature, making amount, taking amount
 *   * Returns: actual making amount filled, actual taking amount filled
 * 
 * - cancelOrder(LimitOrder calldata order) external
 *   * Cancels a limit order
 *   * Arguments: order struct to cancel
 * 
 * - remaining(bytes32 orderHash) external view returns (uint256)
 *   * Gets remaining fillable amount for order
 *   * Arguments: order hash
 *   * Returns: remaining making amount
 * 
 * - invalidatorForOrderRFQ(address maker, uint256 slot) external view returns (uint256)
 *   * Gets invalidator bitmap for RFQ orders
 *   * Arguments: maker address, slot number
 *   * Returns: invalidator bitmap
 * 
 * - checkPredicate(LimitOrder calldata order) external view returns (bool)
 *   * Checks if order predicate conditions are met
 *   * Arguments: order struct
 *   * Returns: true if conditions satisfied
 * 
 * - simulate(address target, bytes calldata data) external
 *   * Simulates contract call for testing
 *   * Arguments: target contract, call data
 * 
 * STRUCTS:
 * - LimitOrder: {
 *     uint256 salt,
 *     address makerAsset,
 *     address takerAsset,
 *     bytes makerAssetData,
 *     bytes takerAssetData,
 *     bytes getMakingAmount,
 *     bytes getTakingAmount,
 *     bytes predicate,
 *     bytes permit,
 *     bytes interaction
 *   }
 * 
 * EVENTS:
 * - OrderFilled(address indexed maker, bytes32 orderHash, uint256 remaining)
 * - OrderCanceled(address indexed maker, bytes32 orderHash, uint256 remainingRaw)
 * - OrderFilledRFQ(bytes32 orderHash, uint256 makingAmount)
 * 
 * REQUIREMENTS:
 * - Must support complex order conditions and predicates
 * - Must handle partial fills efficiently
 * - Must provide order cancellation mechanisms
 * - Must support RFQ (Request for Quote) orders
 * - Must integrate with permit functionality for gasless approvals
 * 
 * CONNECTED SYSTEM COMPONENTS:
 * - XMBLVault.sol - May use limit orders for strategic token swaps
 * - server/oneInchService.ts - Creates and monitors limit orders
 * - libraries/OneInchHelper.sol - Helper functions for order construction
 * - YieldManager.sol - May use for automated rebalancing orders
 * 
 * ORDER FEATURES:
 * - Conditional execution based on predicates
 * - Dynamic pricing through getter functions
 * - Interaction hooks for custom logic
 * - Permit integration for gasless approvals
 * - RFQ support for better pricing
 * 
 * PREDICATE EXAMPLES:
 * - Time-based conditions (after timestamp)
 * - Price-based conditions (oracle price triggers)
 * - Balance-based conditions (user balance thresholds)
 * - Custom contract state conditions
 * 
 * INTEGRATION PATTERNS:
 * - Create orders with appropriate predicates
 * - Monitor order status and remaining amounts
 * - Handle partial fills in application logic
 * - Implement proper error handling for failed fills
 */
interface ILimitOrderProtocol {
    
    // Structs
    struct LimitOrder {
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
    
    // Events
    event OrderFilled(
        address indexed maker,
        bytes32 indexed orderHash,
        uint256 remaining
    );
    
    event OrderCanceled(
        address indexed maker,
        bytes32 indexed orderHash,
        uint256 remainingRaw
    );
    
    event OrderFilledRFQ(
        bytes32 indexed orderHash,
        uint256 makingAmount
    );
    
    /**
     * @dev Fills a limit order partially or completely
     * @param order Order struct
     * @param signature Maker signature
     * @param makingAmount Amount of maker tokens to fill
     * @param takingAmount Amount of taker tokens to fill
     * @return actualMakingAmount Actual amount of maker tokens filled
     * @return actualTakingAmount Actual amount of taker tokens filled
     */
    function fillOrder(
        LimitOrder calldata order,
        bytes calldata signature,
        uint256 makingAmount,
        uint256 takingAmount
    ) external returns (uint256 actualMakingAmount, uint256 actualTakingAmount);
    
    /**
     * @dev Cancels a limit order
     * @param order Order struct to cancel
     */
    function cancelOrder(LimitOrder calldata order) external;
    
    /**
     * @dev Gets remaining fillable amount for order
     * @param orderHash Order hash
     * @return remaining Remaining making amount
     */
    function remaining(bytes32 orderHash) external view returns (uint256 remaining);
    
    /**
     * @dev Gets invalidator bitmap for RFQ orders
     * @param maker Maker address
     * @param slot Slot number
     * @return invalidator Invalidator bitmap
     */
    function invalidatorForOrderRFQ(address maker, uint256 slot) external view returns (uint256 invalidator);
    
    /**
     * @dev Checks if order predicate conditions are met
     * @param order Order struct
     * @return True if conditions satisfied
     */
    function checkPredicate(LimitOrder calldata order) external view returns (bool);
    
    /**
     * @dev Simulates contract call for testing
     * @param target Target contract
     * @param data Call data
     */
    function simulate(address target, bytes calldata data) external;
    
    /**
     * @dev Gets order hash from order data
     * @param order Order struct
     * @return orderHash Computed order hash
     */
    function hashOrder(LimitOrder calldata order) external pure returns (bytes32 orderHash);
    
    /**
     * @dev Validates order signature
     * @param order Order struct
     * @param signature Order signature
     * @return True if signature is valid
     */
    function isValidSignature(LimitOrder calldata order, bytes calldata signature) external view returns (bool);
    
    /**
     * @dev Gets order status
     * @param orderHash Order hash
     * @return status Order status (0=active, 1=filled, 2=cancelled)
     */
    function getOrderStatus(bytes32 orderHash) external view returns (uint256 status);
}
