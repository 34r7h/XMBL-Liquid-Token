// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOneInchRouter {
    function swap(
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 minReturn,
        address payable recipient,
        bytes calldata data
    ) external payable returns (uint256);
}

library OneInchHelper {
    // This is a placeholder for the 1inch router address.
    // It should be set to the correct address for the target network.
    address constant ONE_INCH_ROUTER = 0x1111111254EEB25477B68fb85Ed929f73A960582;

    function swapTokens(
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 minReturn
    ) internal {
        IOneInchRouter router = IOneInchRouter(ONE_INCH_ROUTER);
        // The `data` parameter is used to specify additional parameters for the swap,
        // such as the desired exchange and slippage.
        // For now, we'll pass an empty `bytes` array.
        router.swap(fromToken, toToken, amount, minReturn, payable(msg.sender), "");
    }
}
