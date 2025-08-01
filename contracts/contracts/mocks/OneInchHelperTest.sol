// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../libraries/OneInchHelper.sol";

/**
 * @title OneInchHelperTest
 * @dev Test contract to expose OneInchHelper library functions for testing
 */
contract OneInchHelperTest {
    using OneInchHelper for *;
    
    // Expose constants
    function MAX_SLIPPAGE() external pure returns (uint256) {
        return OneInchHelper.MAX_SLIPPAGE;
    }
    
    function BASIS_POINTS() external pure returns (uint256) {
        return OneInchHelper.BASIS_POINTS;
    }
    
    function DEFAULT_GAS_LIMIT() external pure returns (uint256) {
        return OneInchHelper.DEFAULT_GAS_LIMIT;
    }
    
    // Expose library functions
    function buildLimitOrder(
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount,
        address maker
    ) external view returns (bytes memory) {
        return OneInchHelper.buildLimitOrder(makerAsset, takerAsset, makingAmount, takingAmount, maker);
    }
    
    function calculateOptimalSlippage(
        uint256 amount,
        uint256 marketPrice,
        uint256 maxSlippage
    ) external pure returns (uint256) {
        return OneInchHelper.calculateOptimalSlippage(amount, marketPrice, maxSlippage);
    }
    
    function encodeSwapData(
        address fromToken,
        address toToken,
        uint256 amount,
        bytes memory routerCalldata
    ) external pure returns (bytes memory) {
        return OneInchHelper.encodeSwapData(fromToken, toToken, amount, routerCalldata);
    }
    
    function validateOrderSignature(
        bytes32 orderHash,
        bytes memory signature,
        address expectedSigner
    ) external pure returns (bool) {
        return OneInchHelper.validateOrderSignature(orderHash, signature, expectedSigner);
    }
    
    function calculateFees(
        uint256 amount,
        uint256 feeRate
    ) external pure returns (uint256, uint256) {
        return OneInchHelper.calculateFees(amount, feeRate);
    }
    
    function buildPredicateCondition(
        uint256 minPrice,
        uint256 maxPrice,
        uint256 deadline
    ) external view returns (bytes memory) {
        return OneInchHelper.buildPredicateCondition(minPrice, maxPrice, deadline);
    }
    
    function parseSwapResult(
        bytes memory swapResult
    ) external pure returns (uint256, uint256) {
        return OneInchHelper.parseSwapResult(swapResult);
    }
    
    function estimateGasForSwap(
        address fromToken,
        address toToken,
        uint256 amount
    ) external pure returns (uint256) {
        return OneInchHelper.estimateGasForSwap(fromToken, toToken, amount);
    }
    
    function getOptimalRouter(
        address fromToken,
        address toToken,
        uint256 amount
    ) external pure returns (address) {
        return OneInchHelper.getOptimalRouter(fromToken, toToken, amount);
    }
    
    function buildBatchSwapData(
        OneInchHelper.SwapParams[] memory swaps
    ) external pure returns (bytes memory) {
        return OneInchHelper.buildBatchSwapData(swaps);
    }
}
