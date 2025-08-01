// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title OneInchHelper
 * @dev Library providing helper functions for 1inch protocol interactions and order management
 * 
 * PURPOSE:
 * Utility library containing reusable functions for constructing 1inch orders,
 * calculating optimal swap parameters, handling order validation, and managing
 * complex 1inch protocol interactions efficiently.
 * 
 * MAIN FUNCTIONS:
 * - buildLimitOrder(address makerAsset, address takerAsset, uint256 makingAmount, uint256 takingAmount, address maker) internal pure returns (bytes memory)
 *   * Constructs properly formatted limit order data
 *   * Arguments: maker token, taker token, making amount, taking amount, maker address
 *   * Returns: encoded order data
 * 
 * - calculateOptimalSlippage(uint256 amount, uint256 marketPrice, uint256 maxSlippage) internal pure returns (uint256)
 *   * Calculates optimal slippage protection for swap
 *   * Arguments: swap amount, current market price, maximum allowed slippage
 *   * Returns: recommended minimum return amount
 * 
 * - encodeSwapData(address fromToken, address toToken, uint256 amount, bytes memory routerCalldata) internal pure returns (bytes memory)
 *   * Encodes swap parameters for 1inch router calls
 *   * Arguments: source token, destination token, amount, router-specific calldata
 *   * Returns: encoded swap data
 * 
 * - validateOrderSignature(bytes32 orderHash, bytes memory signature, address expectedSigner) internal pure returns (bool)
 *   * Validates 1inch order signature
 *   * Arguments: order hash, signature bytes, expected signer address
 *   * Returns: true if signature is valid
 * 
 * - calculateFees(uint256 amount, uint256 feeRate) internal pure returns (uint256, uint256)
 *   * Calculates protocol and network fees for swaps
 *   * Arguments: swap amount, fee rate in basis points
 *   * Returns: protocol fee amount, net amount after fees
 * 
 * - buildPredicateCondition(uint256 minPrice, uint256 maxPrice, uint256 deadline) internal pure returns (bytes memory)
 *   * Builds predicate condition for conditional orders
 *   * Arguments: minimum price, maximum price, deadline timestamp
 *   * Returns: encoded predicate data
 * 
 * - parseSwapResult(bytes memory swapResult) internal pure returns (uint256 returnAmount, uint256 gasUsed)
 *   * Parses result data from completed swap
 *   * Arguments: raw swap result data
 *   * Returns: actual return amount, gas consumed
 * 
 * - estimateGasForSwap(address fromToken, address toToken, uint256 amount) internal view returns (uint256)
 *   * Estimates gas cost for token swap
 *   * Arguments: source token, destination token, swap amount
 *   * Returns: estimated gas units
 * 
 * - getOptimalRouter(address fromToken, address toToken, uint256 amount) internal view returns (address)
 *   * Determines best 1inch router for given swap
 *   * Arguments: source token, destination token, swap amount
 *   * Returns: optimal router address
 * 
 * - buildBatchSwapData(SwapParams[] memory swaps) internal pure returns (bytes memory)
 *   * Constructs data for batch swap operations
 *   * Arguments: array of swap parameters
 *   * Returns: encoded batch swap data
 * 
 * STRUCTS:
 * - SwapParams: {
 *     address fromToken,
 *     address toToken,
 *     uint256 amount,
 *     uint256 minReturn,
 *     bytes routerData
 *   }
 * 
 * CONSTANTS:
 * - uint256 public constant MAX_SLIPPAGE = 1000; // 10% maximum slippage
 * - uint256 public constant BASIS_POINTS = 10000; // 100% in basis points
 * - uint256 public constant DEFAULT_GAS_LIMIT = 300000; // Default gas limit for swaps
 * 
 * REQUIREMENTS:
 * - Must provide gas-efficient utility functions
 * - Must handle various 1inch protocol versions
 * - Must support both simple and complex order types
 * - Must include proper input validation
 * - Must be compatible with different router implementations
 * - Must provide error handling for edge cases
 * 
 * CONNECTED SYSTEM COMPONENTS:
 * - XMBLVault.sol - Uses helper functions for swap operations
 * - interfaces/I1inchFusion.sol - Works with Fusion protocol
 * - interfaces/ILimitOrderProtocol.sol - Assists with limit orders
 * - server/oneInchService.ts - Off-chain complement for complex operations
 * 
 * OPTIMIZATION FEATURES:
 * - Gas-efficient order construction
 * - Optimal slippage calculation algorithms
 * - Smart routing for best execution
 * - Batch operation support for multiple swaps
 * - Caching for frequently used calculations
 * 
 * SECURITY CONSIDERATIONS:
 * - Input validation for all parameters
 * - Overflow protection in calculations
 * - Signature verification utilities
 * - Slippage protection mechanisms
 * - Deadline enforcement for time-sensitive operations
 * 
 * INTEGRATION PATTERNS:
 * - Import and use functions in contracts
 * - Combine with 1inch interfaces for complete functionality
 * - Use for both on-chain and off-chain order preparation
 * - Extend with protocol-specific customizations
 */
library OneInchHelper {
    
    // Constants
    uint256 public constant MAX_SLIPPAGE = 1000; // 10% maximum slippage
    uint256 public constant BASIS_POINTS = 10000; // 100% in basis points
    uint256 public constant DEFAULT_GAS_LIMIT = 300000; // Default gas limit for swaps
    
    // Structs
    struct SwapParams {
        address fromToken;
        address toToken;
        uint256 amount;
        uint256 minReturn;
        bytes routerData;
    }
    
    /**
     * @dev Constructs properly formatted limit order data
     * @param makerAsset Maker token address
     * @param takerAsset Taker token address  
     * @param makingAmount Amount of maker tokens
     * @param takingAmount Amount of taker tokens
     * @param maker Maker address
     * @return Encoded order data
     */
    function buildLimitOrder(
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount,
        address maker
    ) internal view returns (bytes memory) {
        require(makerAsset != address(0), "Invalid maker asset");
        require(takerAsset != address(0), "Invalid taker asset");
        require(makingAmount > 0, "Making amount must be greater than zero");
        require(takingAmount > 0, "Taking amount must be greater than zero");
        require(maker != address(0), "Invalid maker address");
        
        return abi.encode(makerAsset, takerAsset, makingAmount, takingAmount, maker, block.timestamp + 3600);
    }
    
    /**
     * @dev Calculates optimal slippage protection for swap
     * @param amount Swap amount
     * @param marketPrice Current market price 
     * @param maxSlippage Maximum allowed slippage
     * @return Recommended minimum return amount
     */
    function calculateOptimalSlippage(
        uint256 amount,
        uint256 marketPrice,
        uint256 maxSlippage
    ) internal pure returns (uint256) {
        require(amount > 0, "Amount must be greater than zero");
        require(marketPrice > 0, "Price must be greater than zero");
        require(maxSlippage <= MAX_SLIPPAGE, "Slippage exceeds maximum");
        
        uint256 expectedReturn = amount * marketPrice;
        uint256 slippageAmount = (expectedReturn * maxSlippage) / BASIS_POINTS;
        
        return expectedReturn - slippageAmount;
    }
    
    /**
     * @dev Encodes swap parameters for 1inch router calls
     * @param fromToken Source token address
     * @param toToken Destination token address
     * @param amount Swap amount
     * @param routerCalldata Router-specific calldata
     * @return Encoded swap data
     */
    function encodeSwapData(
        address fromToken,
        address toToken,
        uint256 amount,
        bytes memory routerCalldata
    ) internal pure returns (bytes memory) {
        require(fromToken != address(0), "Invalid from token");
        require(toToken != address(0), "Invalid to token");
        require(amount > 0, "Amount must be greater than zero");
        
        return abi.encode(fromToken, toToken, amount, routerCalldata);
    }
    
    /**
     * @dev Validates 1inch order signature
     * @param orderHash Order hash
     * @param signature Signature bytes
     * @param expectedSigner Expected signer address
     * @return True if signature is valid
     */
    function validateOrderSignature(
        bytes32 orderHash,
        bytes memory signature,
        address expectedSigner
    ) internal pure returns (bool) {
        require(orderHash != bytes32(0), "Invalid order hash");
        require(expectedSigner != address(0), "Invalid expected signer");
        
        if (signature.length == 0) {
            revert("Empty signature");
        }
        
        if (signature.length != 65) {
            revert("Invalid signature format");
        }
        
        // Extract signature components
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        // Create Ethereum signed message hash
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", orderHash));
        
        // Recover signer from signature
        address recoveredSigner = ecrecover(ethSignedMessageHash, v, r, s);
        return recoveredSigner == expectedSigner;
    }
    
    /**
     * @dev Calculates protocol and network fees for swaps
     * @param amount Swap amount
     * @param feeRate Fee rate in basis points
     * @return feeAmount Protocol fee amount
     * @return netAmount Net amount after fees
     */
    function calculateFees(
        uint256 amount,
        uint256 feeRate
    ) internal pure returns (uint256 feeAmount, uint256 netAmount) {
        require(amount > 0, "Amount must be greater than zero");
        require(feeRate <= BASIS_POINTS, "Fee rate too high");
        
        // Check for overflow in multiplication
        if (amount > 0 && feeRate > 0 && amount > type(uint256).max / feeRate) {
            revert("Calculation overflow");
        }
        
        feeAmount = (amount * feeRate) / BASIS_POINTS;
        netAmount = amount - feeAmount;
        
        return (feeAmount, netAmount);
    }
    
    /**
     * @dev Builds predicate condition for conditional orders
     * @param minPrice Minimum price
     * @param maxPrice Maximum price
     * @param deadline Deadline timestamp
     * @return Encoded predicate data
     */
    function buildPredicateCondition(
        uint256 minPrice,
        uint256 maxPrice,
        uint256 deadline
    ) internal view returns (bytes memory) {
        require(deadline > block.timestamp, "Deadline must be in future");
        require(minPrice > 0, "Prices must be greater than zero");
        require(maxPrice >= minPrice, "Invalid price range");
        
        return abi.encode(minPrice, maxPrice, deadline, block.timestamp);
    }
    
    /**
     * @dev Parses result data from completed swap
     * @param swapResult Raw swap result data
     * @return returnAmount Return amount from swap
     * @return gasUsed Gas consumed during swap
     */
    function parseSwapResult(
        bytes memory swapResult
    ) internal pure returns (uint256 returnAmount, uint256 gasUsed) {
        if (swapResult.length == 0) {
            revert("Empty swap result");
        }
        
        if (swapResult.length < 64) {
            revert("Invalid swap result format");
        }
        
        (returnAmount, gasUsed) = abi.decode(swapResult, (uint256, uint256));
        
        require(returnAmount > 0, "Invalid return amount");
        require(gasUsed > 0, "Invalid gas usage");
    }
    
    /**
     * @dev Estimates gas cost for token swap
     * @param fromToken Source token address
     * @param toToken Destination token address
     * @param amount Swap amount
     * @return Estimated gas units
     */
    function estimateGasForSwap(
        address fromToken,
        address toToken,
        uint256 amount
    ) internal pure returns (uint256) {
        require(fromToken != address(0), "Invalid from token");
        require(toToken != address(0), "Invalid to token");
        require(amount > 0, "Invalid amount");
        require(fromToken != toToken, "Cannot swap same token");
        
        // Base gas for simple swap
        uint256 baseGas = DEFAULT_GAS_LIMIT;
        
        // Additional gas for ETH swaps
        if (fromToken == address(0) || toToken == address(0)) {
            baseGas += 50000;
        }
        
        // Scale with amount (larger amounts may need more gas)
        uint256 scalingFactor = amount > 1e21 ? 2 : 1; // If amount > 1000 tokens
        
        return baseGas * scalingFactor;
    }
    
    /**
     * @dev Determines best 1inch router for given swap
     * @param fromToken Source token address
     * @param toToken Destination token address
     * @param amount Swap amount
     * @return Optimal router address
     */
    function getOptimalRouter(
        address fromToken,
        address toToken,
        uint256 amount
    ) internal pure returns (address) {
        require(fromToken != address(0), "Invalid from token");
        require(toToken != address(0), "Invalid to token");
        require(amount > 0, "Invalid amount");
        
        // Simplified router selection logic
        // In production, this would query multiple routers
        
        // Default 1inch v5 router (mainnet)
        address defaultRouter = 0x1111111254EEB25477B68fb85Ed929f73A960582;
        
        // For unsupported token pairs, revert
        if (fromToken == toToken) {
            revert("No router available for token pair");
        }
        
        // For large amounts, might prefer different router
        if (amount > 1e21) { // > 1000 tokens
            return defaultRouter;
        }
        
        return defaultRouter;
    }
    
    /**
     * @dev Constructs data for batch swap operations
     * @param swaps Array of swap parameters
     * @return Encoded batch swap data
     */
    function buildBatchSwapData(
        SwapParams[] memory swaps
    ) internal pure returns (bytes memory) {
        require(swaps.length > 0, "Empty batch not allowed");
        require(swaps.length <= 10, "Too many swaps"); // Limit for gas efficiency
        
        for (uint256 i = 0; i < swaps.length; i++) {
            require(swaps[i].fromToken != address(0), "Invalid swap parameters");
            require(swaps[i].toToken != address(0), "Invalid swap parameters");
            require(swaps[i].amount > 0, "Invalid swap parameters");
            require(swaps[i].minReturn > 0, "Invalid swap parameters");
        }
        
        return abi.encode(swaps);
    }
}
