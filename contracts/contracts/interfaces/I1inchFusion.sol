// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title I1inchFusion
 * @dev Interface for 1inch Fusion+ smart contract interactions
 * 
 * PURPOSE:
 * Defines the interface for interacting with 1inch Fusion+ protocol,
 * enabling gasless and MEV-protected token swaps through resolver network.
 * 
 * MAIN FUNCTIONS:
 * - fillOrder(bytes calldata order, bytes calldata signature, uint256 makingAmount, uint256 takingAmount) external
 *   * Fills a Fusion order with specified amounts
 *   * Arguments: order data, signature, making amount, taking amount
 *   * Returns: actual amounts filled
 * 
 * - createOrder(address makerAsset, address takerAsset, uint256 makingAmount, uint256 takingAmount, bytes calldata data) external returns (bytes32)
 *   * Creates a new Fusion order
 *   * Arguments: maker token, taker token, making amount, taking amount, additional data
 *   * Returns: order hash
 * 
 * - cancelOrder(bytes32 orderHash) external
 *   * Cancels an active order
 *   * Arguments: hash of order to cancel
 * 
 * - getOrderStatus(bytes32 orderHash) external view returns (uint256)
 *   * Gets current status of an order
 *   * Arguments: order hash
 *   * Returns: order status (active, filled, cancelled)
 * 
 * - getOrderRemainingAmount(bytes32 orderHash) external view returns (uint256)
 *   * Gets remaining fillable amount for order
 *   * Arguments: order hash
 *   * Returns: remaining amount
 * 
 * - isValidSignature(bytes32 orderHash, bytes calldata signature) external view returns (bool)
 *   * Validates order signature
 *   * Arguments: order hash, signature
 *   * Returns: true if valid
 * 
 * EVENTS:
 * - OrderFilled(bytes32 indexed orderHash, address indexed maker, address indexed taker, uint256 makingAmount, uint256 takingAmount)
 * - OrderCreated(bytes32 indexed orderHash, address indexed maker, address makerAsset, address takerAsset)
 * - OrderCancelled(bytes32 indexed orderHash, address indexed maker)
 * 
 * REQUIREMENTS:
 * - Must support gasless trading through resolver network
 * - Must provide MEV protection for orders
 * - Must handle partial fills efficiently
 * - Must support various order types (limit, market, stop-loss)
 * - Must integrate with 1inch aggregation protocol
 * 
 * CONNECTED SYSTEM COMPONENTS:
 * - XMBLVault.sol - Uses for executing swaps from deposited tokens to WBTC
 * - server/oneInchService.ts - Interfaces with this contract for swap execution
 * - libraries/OneInchHelper.sol - Helper functions for order creation and management
 * 
 * FUSION+ FEATURES:
 * - Gasless trading (resolvers pay gas)
 * - MEV protection through private mempool
 * - Price improvement through competition
 * - Atomic settlement guarantees
 * - Cross-chain order support
 * 
 * INTEGRATION NOTES:
 * - Requires proper order construction with valid signatures
 * - Should handle slippage and price protection
 * - Must monitor order status for completion
 * - Should implement retry logic for failed orders
 */
interface I1inchFusion {
    
    // Events
    event OrderFilled(
        bytes32 indexed orderHash,
        address indexed maker,
        address indexed taker,
        uint256 makingAmount,
        uint256 takingAmount
    );
    
    event OrderCreated(
        bytes32 indexed orderHash,
        address indexed maker,
        address makerAsset,
        address takerAsset
    );
    
    event OrderCancelled(
        bytes32 indexed orderHash,
        address indexed maker
    );
    
    /**
     * @dev Fills a Fusion order with specified amounts
     * @param order Order data
     * @param signature Order signature
     * @param makingAmount Amount of maker tokens
     * @param takingAmount Amount of taker tokens
     * @return actualMakingAmount Actual amount of maker tokens filled
     * @return actualTakingAmount Actual amount of taker tokens filled
     */
    function fillOrder(
        bytes calldata order,
        bytes calldata signature,
        uint256 makingAmount,
        uint256 takingAmount
    ) external returns (uint256 actualMakingAmount, uint256 actualTakingAmount);
    
    /**
     * @dev Creates a new Fusion order
     * @param makerAsset Maker token address
     * @param takerAsset Taker token address
     * @param makingAmount Amount of maker tokens
     * @param takingAmount Amount of taker tokens
     * @param data Additional order data
     * @return orderHash Hash of created order
     */
    function createOrder(
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount,
        bytes calldata data
    ) external returns (bytes32 orderHash);
    
    /**
     * @dev Cancels an active order
     * @param orderHash Hash of order to cancel
     */
    function cancelOrder(bytes32 orderHash) external;
    
    /**
     * @dev Gets current status of an order
     * @param orderHash Order hash
     * @return status Order status (0=active, 1=filled, 2=cancelled)
     */
    function getOrderStatus(bytes32 orderHash) external view returns (uint256 status);
    
    /**
     * @dev Gets remaining fillable amount for order
     * @param orderHash Order hash
     * @return remainingAmount Remaining amount that can be filled
     */
    function getOrderRemainingAmount(bytes32 orderHash) external view returns (uint256 remainingAmount);
    
    /**
     * @dev Validates order signature
     * @param orderHash Order hash
     * @param signature Order signature
     * @return isValid True if signature is valid
     */
    function isValidSignature(bytes32 orderHash, bytes calldata signature) external view returns (bool isValid);
    
    /**
     * @dev Gets order information by hash
     * @param orderHash Order hash
     * @return maker Maker address
     * @return makerAsset Maker token address
     * @return takerAsset Taker token address
     * @return makingAmount Total making amount
     * @return takingAmount Total taking amount
     * @return filledAmount Amount already filled
     */
    function getOrderInfo(bytes32 orderHash) external view returns (
        address maker,
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 filledAmount
    );
    
    /**
     * @dev Calculates order hash from order data
     * @param orderData Order data
     * @return orderHash Computed order hash
     */
    function hashOrder(bytes calldata orderData) external pure returns (bytes32 orderHash);
    
    /**
     * @dev Gets resolver network information
     * @return resolverCount Number of active resolvers
     * @return averageResolutionTime Average time to resolve orders
     */
    function getResolverInfo() external view returns (uint256 resolverCount, uint256 averageResolutionTime);
}
