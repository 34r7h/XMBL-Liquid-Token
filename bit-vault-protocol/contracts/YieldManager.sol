// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Minimal interface for Compound V3's Comet contract
interface IComet {
    function supply(address asset, uint amount) external;
    function withdraw(address asset, uint amount) external;
}

contract YieldManager {
    address public owner;
    IComet public comet;

    constructor(address _comet) {
        owner = msg.sender;
        comet = IComet(_comet);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    function supplyAsset(address asset, uint256 amount) external onlyOwner {
        IERC20(asset).approve(address(comet), amount);
        comet.supply(asset, amount);
    }

    function withdrawAsset(address asset, uint256 amount) external onlyOwner {
        comet.withdraw(asset, amount);
    }

    // Function to harvest yield would be more complex, involving calculating the profit
    // and transferring it back to the BitVaultProtocol. This is a simplified version.
    function harvest() external onlyOwner {
        // In a real scenario, this function would calculate and transfer the yield.
        // For now, it's a placeholder.
    }
}
