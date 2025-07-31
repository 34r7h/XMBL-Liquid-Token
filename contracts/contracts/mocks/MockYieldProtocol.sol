// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockYieldProtocol {
    string public name;
    string public apy;
    uint256 public accumulatedYield;
    bool public hasFailed;

    constructor(string memory _name, string memory _apy) {
        name = _name;
        apy = _apy;
    }

    function setAPY(string memory _apy) external {
        apy = _apy;
    }

    function addYield(uint256 amount) external {
        accumulatedYield += amount;
    }

    function getYield() external view returns (uint256) {
        return accumulatedYield;
    }

    function harvestYield() external returns (uint256) {
        uint256 yield = accumulatedYield;
        accumulatedYield = 0;
        return yield;
    }

    function simulateFailure() external {
        hasFailed = true;
    }

    function deposit(address token, uint256 amount) external {
        require(!hasFailed, "Protocol has failed");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }

    function withdraw(address token, uint256 amount) external {
        require(!hasFailed, "Protocol has failed");
        IERC20(token).transfer(msg.sender, amount);
    }

    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
