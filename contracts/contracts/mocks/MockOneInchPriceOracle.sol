// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockOneInchPriceOracle
 * @dev Mock implementation of 1inch price oracle for testing
 */
contract MockOneInchPriceOracle {
    // Mapping from token address to its rate against ETH (in wei per token unit)
    mapping(address => uint256) private rates;
    
    constructor() {
        // Set some default rates for testing
        // USDC (6 decimals): $3000 per ETH, so 1 USDC = ETH/3000 = 0.000333... ETH
        // For 1e6 USDC units, rate = 0.000333 * 1e18 = 333333333333333
        
        // WBTC (8 decimals): $60000 per BTC, $3000 per ETH, so 1 WBTC = 20 ETH
        // For 1e8 WBTC units, rate = 20 * 1e18 = 20000000000000000000
    }
    
    /**
     * @dev Set the rate for a token against ETH
     * @param token Token address
     * @param rate How much ETH (in wei) you get for 1 unit of the token
     */
    function setRate(address token, uint256 rate) external {
        rates[token] = rate;
    }
    
    /**
     * @dev Get rate of token to ETH
     * @param srcToken Source token address
     * @param useSrcWrappers Whether to use wrapped tokens (ignored in mock)
     * @return rate Amount of ETH (in wei) per 1 unit of srcToken
     */
    function getRateToEth(address srcToken, bool useSrcWrappers) external view returns (uint256) {
        useSrcWrappers; // Silence unused parameter warning
        
        if (rates[srcToken] == 0) {
            // Default rate: assume 1:1 conversion for testing
            return 1e18;
        }
        
        return rates[srcToken];
    }
    
    /**
     * @dev Get rate between two tokens
     * @param srcToken Source token
     * @param dstToken Destination token  
     * @param useWrappers Whether to use wrapped tokens (ignored in mock)
     * @return rate Exchange rate
     */
    function getRate(address srcToken, address dstToken, bool useWrappers) external view returns (uint256) {
        useWrappers; // Silence unused parameter warning
        
        // For simplicity, convert both to ETH rates and calculate
        uint256 srcToEth = rates[srcToken] == 0 ? 1e18 : rates[srcToken];
        uint256 dstToEth = rates[dstToken] == 0 ? 1e18 : rates[dstToken];
        
        // rate = srcToEth / dstToEth
        return (srcToEth * 1e18) / dstToEth;
    }
}
