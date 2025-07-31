// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockDeFiProtocol {
    mapping(address => uint256) public balances;
    mapping(address => uint256) public yields;
    mapping(address => uint256) public lastUpdateTime;
    
    uint256 public constant YIELD_RATE = 5; // 5% APY for testing
    uint256 public constant SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
    
    bool public shouldRevert;
    address public yieldToken;
    
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event YieldClaimed(address indexed user, uint256 amount);
    
    constructor(address _yieldToken) {
        yieldToken = _yieldToken;
        shouldRevert = false;
    }
    
    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }
    
    function deposit(uint256 amount) external {
        require(!shouldRevert, "MockDeFi: Forced revert");
        require(amount > 0, "MockDeFi: Invalid amount");
        
        _updateYield(msg.sender);
        balances[msg.sender] += amount;
        
        emit Deposit(msg.sender, amount);
    }
    
    function withdraw(uint256 amount) external {
        require(!shouldRevert, "MockDeFi: Forced revert");
        require(amount <= balances[msg.sender], "MockDeFi: Insufficient balance");
        
        _updateYield(msg.sender);
        balances[msg.sender] -= amount;
        
        emit Withdraw(msg.sender, amount);
    }
    
    function claimYield() external returns (uint256 yieldAmount) {
        require(!shouldRevert, "MockDeFi: Forced revert");
        
        _updateYield(msg.sender);
        yieldAmount = yields[msg.sender];
        yields[msg.sender] = 0;
        
        emit YieldClaimed(msg.sender, yieldAmount);
        return yieldAmount;
    }
    
    function getPendingYield(address user) external view returns (uint256) {
        if (balances[user] == 0) return yields[user];
        
        uint256 timeElapsed = block.timestamp - lastUpdateTime[user];
        uint256 newYield = (balances[user] * YIELD_RATE * timeElapsed) / (SECONDS_PER_YEAR * 100);
        
        return yields[user] + newYield;
    }
    
    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }
    
    function _updateYield(address user) internal {
        if (balances[user] > 0 && lastUpdateTime[user] > 0) {
            uint256 timeElapsed = block.timestamp - lastUpdateTime[user];
            uint256 newYield = (balances[user] * YIELD_RATE * timeElapsed) / (SECONDS_PER_YEAR * 100);
            yields[user] += newYield;
        }
        lastUpdateTime[user] = block.timestamp;
    }
    
    // Compound/Aave-like interface methods
    function mint(uint256 mintAmount) external returns (uint256) {
        this.deposit(mintAmount);
        return 0; // Success
    }
    
    function redeem(uint256 redeemTokens) external returns (uint256) {
        this.withdraw(redeemTokens);
        return 0; // Success
    }
    
    function balanceOf(address owner) external view returns (uint256) {
        return balances[owner];
    }
}
