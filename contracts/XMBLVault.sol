// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./XMBLToken.sol";
import "./OneInchHelper.sol";

contract XMBLVault is Ownable, ReentrancyGuard {
    using OneInchHelper for address;

    XMBLToken public xmblToken;

    // Hardcoded WBTC address for Sepolia
    address public constant WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;

    // Placeholder for Wormhole bridge
    address public wormholeBridge;

    // Mapping from user to their deposited amount
    mapping(address => uint256) public deposited;

    event Deposited(address indexed user, address fromToken, uint256 amount);

    constructor(address _xmblTokenAddress) Ownable(msg.sender) {
        xmblToken = XMBLToken(_xmblTokenAddress);
    }

    function depositAndSwap(address fromToken, uint256 amount, uint256 minReturn) external nonReentrant {
        // Transfer the token from the user to this contract
        IERC20(fromToken).transferFrom(msg.sender, address(this), amount);

        // Approve the 1inch router to spend the token
        IERC20(fromToken).approve(OneInchHelper.ONE_INCH_ROUTER, amount);

        // Swap the token to WBTC
        fromToken.swapTokens(WBTC, amount, minReturn);

        // For now, we'll just record the deposit.
        // In the future, this will trigger a Wormhole bridge.
        deposited[msg.sender] += amount;
        emit Deposited(msg.sender, fromToken, amount);

        // Minting of XMBL tokens will be handled by the off-chain resolver
        // after the BTC is confirmed on the Bitcoin testnet.

        // Initiate the Wormhole bridge transfer
        initiateWormholeTransfer(amount);
    }

    event WormholeTransferInitiated(address indexed user, uint256 amount);

    function initiateWormholeTransfer(uint256 amount) internal {
        // This function will be called by the off-chain resolver to initiate the
        // Wormhole bridge transfer.
        // For now, we'll just emit an event.
        emit WormholeTransferInitiated(msg.sender, amount);
    }

    // Function to set the Wormhole bridge address
    function setWormholeBridge(address _bridge) external onlyOwner {
        wormholeBridge = _bridge;
    }
}
