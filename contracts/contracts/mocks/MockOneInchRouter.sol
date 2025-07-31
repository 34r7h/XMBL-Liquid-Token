// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockOneInchRouter {
    mapping(address => uint256) public tokenPrices;
    bool public shouldRevert;
    
    event Swap(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    constructor() {
        // Set default prices (1:1 for simplicity)
        shouldRevert = false;
    }
    
    function setTokenPrice(address token, uint256 price) external {
        tokenPrices[token] = price;
    }
    
    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }
    
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata /* swapData */
    ) external returns (uint256 amountOut) {
        require(!shouldRevert, "MockRouter: Forced revert");
        require(amountIn > 0, "MockRouter: Invalid input amount");
        
        // Simple 1:1 swap with optional price adjustment
        amountOut = amountIn;
        if (tokenPrices[tokenOut] > 0) {
            amountOut = (amountIn * tokenPrices[tokenOut]) / 1e18;
        }
        
        require(amountOut >= minAmountOut, "MockRouter: Insufficient output amount");
        
        emit Swap(tokenIn, tokenOut, amountIn, amountOut);
        return amountOut;
    }
    
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        amountOut = amountIn;
        if (tokenPrices[tokenOut] > 0) {
            amountOut = (amountIn * tokenPrices[tokenOut]) / 1e18;
        }
        return amountOut;
    }
    
    function unoswap(
        address srcToken,
        uint256 amount,
        uint256 minReturn,
        bytes32[] calldata /* pools */
    ) external returns (uint256 returnAmount) {
        require(!shouldRevert, "MockRouter: Forced revert");
        require(amount > 0, "MockRouter: Invalid amount");
        
        returnAmount = amount; // Simple 1:1 for testing
        require(returnAmount >= minReturn, "MockRouter: Insufficient return");
        
        return returnAmount;
    }
}
