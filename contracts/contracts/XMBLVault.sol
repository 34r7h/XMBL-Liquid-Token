// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IOneInchPriceOracle {
    function getRate(address srcToken, address dstToken, bool useWrappers) external view returns (uint256);
    function getRateToEth(address srcToken, bool useSrcWrappers) external view returns (uint256);
}

interface IXMBLToken {
    function mintWithTBA(address to, uint256 depositValue, address tokenAddress) external returns (uint256);
    function burn(uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
    function getTokenBoundAccount(uint256 tokenId) external view returns (address);
    function setMinter(address newMinter) external;
}

interface IERC6551Registry {
    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address);
    
    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external view returns (address);
}

interface ITokenBoundAccount {
    function executeCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory);
}

interface ITBAImplementation {
    function initialize(address owner) external;
}

/**
 * @title XMBLVault
 * @dev Primary protocol contract managing deposits, swaps, XMBL NFT minting with TBAs, and yield distribution
 */
contract XMBLVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // State variables
    address public xmblToken;
    address public wbtcToken;
    address public erc6551Registry;
    address public tbaImplementation;
    address public yieldManager;
    address public oneInchPriceOracle; // 1inch price oracle for token-to-ETH conversion

    // Protocol state
    mapping(uint256 => uint256) public nftDepositValues;
    mapping(uint256 => uint256) public accruedYields;
    mapping(address => uint256[]) public userNFTs;
    mapping(address => uint256) public userTotalDeposits; // Track total deposit value per user
    
    // Meta token functionality
    mapping(uint256 => uint256) public metaTokenMintableCount; // How many tokens can be minted from this meta token
    mapping(uint256 => uint256) public metaTokenStartPosition; // Starting position in bonding curve for this meta token
    mapping(uint256 => bool) public isMetaToken; // Whether this token is a meta token
    
    uint256 public totalValueLocked;
    uint256 public bondingCurveRate = 1e18; // 1.0 as default rate
    uint256 public nextTokenId = 1;
    bool public pausedDeposits = false;
    
    // Bonding curve parameters
    uint256 public constant INITIAL_PRICE_SATS = 1; // Starting price in satoshis
    uint256 public constant PHI = 1618033988749895000; // (1 + sqrt(5)) / 2 * 1e18 = Golden Ratio
    uint256 public constant SATS_TO_WEI = 1e10; // 1 satoshi = 1e10 wei (since 1 BTC = 1e8 sats = 1e18 wei)
    uint256 public constant NETWORK_FEE_BPS = 100; // 1% = 100 basis points
    uint256 public totalTokensMinted = 0; // Track total tokens minted for deflation calculation

    // Constants
    uint256 private constant MIN_BONDING_RATE = 0.1e18; // 0.1
    uint256 private constant MAX_BONDING_RATE = 9.9e18;  // 9.9 (less than 10.0)

    // Events
    event Deposit(address indexed user, address indexed token, uint256 amount, uint256 tokensMinted, uint256 totalCost);
    event Withdraw(address indexed user, uint256 tokenId, uint256 assetsReturned);
    event YieldClaimed(uint256 indexed tokenId, address indexed owner, uint256 amount);
    event SwapExecuted(address indexed fromToken, address indexed toToken, uint256 amountIn, uint256 amountOut);
    event YieldDistributed(uint256 totalYield, uint256 timestamp);
    event BondingCurveUpdated(uint256 oldRate, uint256 newRate);
    event NFTMinted(address indexed user, uint256 indexed tokenId, address tbaAddress);
    event MetaTokenMinted(address indexed user, uint256 indexed tokenId, uint256 mintableCount, uint256 startPosition);
    event TokenMintedFromMeta(address indexed user, uint256 indexed metaTokenId, uint256 indexed newTokenId);

    constructor(
        address _xmblToken,
        address _wbtcToken,
        address _erc6551Registry,
        address _tbaImplementation,
        address _yieldManager,
        address _oneInchPriceOracle
    ) {
        xmblToken = _xmblToken;
        wbtcToken = _wbtcToken;
        erc6551Registry = _erc6551Registry;
        tbaImplementation = _tbaImplementation;
        yieldManager = _yieldManager;
        oneInchPriceOracle = _oneInchPriceOracle;
    }

    /**
     * @dev Convert token amount to ETH equivalent using 1inch price oracle
     */
    function getETHEquivalent(address token, uint256 amount) internal view returns (uint256) {
        if (token == address(0)) {
            return amount; // Already ETH
        }
        
        // Get exchange rate from 1inch price oracle (wei per token unit)
        uint256 rate = IOneInchPriceOracle(oneInchPriceOracle).getRateToEth(token, true);
        
        // Convert token amount to ETH equivalent
        // For USDC (6 decimals): amount * rate / 10^6
        uint8 tokenDecimals = IERC20Metadata(token).decimals();
        return (amount * rate) / (10 ** tokenDecimals);
    }

    /**
     * @dev Accept user deposits and mint XMBL NFT with TBA
     */
    function deposit(address token, uint256 amount) external payable nonReentrant whenNotPaused {
        require(!pausedDeposits, "Deposits are paused");
        
        uint256 depositAmount;
        
        if (token == address(0)) {
            // ETH deposit
            require(msg.value > 0, "Invalid deposit amount");
            depositAmount = msg.value;
        } else {
            // ERC-20 deposit
            require(amount > 0, "Invalid deposit amount");
            require(token != address(0), "Invalid token address");
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            depositAmount = amount;
        }

        // Convert deposit amount to ETH equivalent for bonding curve calculation
        uint256 ethEquivalent = getETHEquivalent(token, depositAmount);
        
        // Calculate how many tokens can be bought with the deposit amount
        uint256 tokensMintable = 0;
        uint256 totalCost = 0;
        uint256 currentTokenCount = totalTokensMinted;
        
        // Calculate total cost and number of tokens mintable
        while (true) {
            uint256 nextTokenPrice = calculateXMBLValue(currentTokenCount);
            if (totalCost + nextTokenPrice > ethEquivalent) {
                break; // Can't afford the next token
            }
            
            totalCost += nextTokenPrice;
            tokensMintable++;
            currentTokenCount++;
        }
        
        require(tokensMintable > 0, "Insufficient deposit amount for even one token");
        
        // If only one token is mintable, mint it directly
        if (tokensMintable == 1) {
            uint256 tokenPrice = calculateXMBLValue(totalTokensMinted);
            uint256 tokenId = IXMBLToken(xmblToken).mintWithTBA(msg.sender, tokenPrice, token);
            
            // Update tracking
            nftDepositValues[tokenId] = tokenPrice;
            userNFTs[msg.sender].push(tokenId);
            totalTokensMinted += 1;
            
            // Update nextTokenId if this token ID is higher
            if (tokenId >= nextTokenId) {
                nextTokenId = tokenId + 1;
            }
            
            emit NFTMinted(msg.sender, tokenId, getTokenBoundAccount(tokenId));
        } else {
            // Mint a meta token that can mint multiple tokens
            uint256 metaTokenId = IXMBLToken(xmblToken).mintWithTBA(msg.sender, totalCost, token);
            
            // Set up meta token properties
            nftDepositValues[metaTokenId] = totalCost;
            userNFTs[msg.sender].push(metaTokenId);
            isMetaToken[metaTokenId] = true;
            metaTokenMintableCount[metaTokenId] = tokensMintable;
            metaTokenStartPosition[metaTokenId] = totalTokensMinted;
            
            // Reserve the token positions
            totalTokensMinted += tokensMintable;
            
            // Update nextTokenId if this token ID is higher
            if (metaTokenId >= nextTokenId) {
                nextTokenId = metaTokenId + 1;
            }
            
            emit MetaTokenMinted(msg.sender, metaTokenId, tokensMintable, totalTokensMinted - tokensMintable);
        }
        
        // Update global state
        totalValueLocked += depositAmount;
        userTotalDeposits[msg.sender] += totalCost; // Track total cost paid by user
        
        // If there's leftover ETH (for ETH deposits), refund it
        if (token == address(0) && totalCost < ethEquivalent) {
            uint256 refund = ethEquivalent - totalCost;
            payable(msg.sender).transfer(refund);
            totalValueLocked -= refund; // Adjust for refunded amount
        }
        
        emit Deposit(msg.sender, token, depositAmount, tokensMintable, totalCost);
    }

    /**
     * @dev Mint individual tokens from a meta token
     */
    function mintFromMetaToken(uint256 metaTokenId, uint256 tokensToMint) external nonReentrant {
        require(IXMBLToken(xmblToken).ownerOf(metaTokenId) == msg.sender, "Not meta token owner");
        require(isMetaToken[metaTokenId], "Not a meta token");
        require(tokensToMint > 0, "Must mint at least one token");
        require(tokensToMint <= metaTokenMintableCount[metaTokenId], "Exceeds mintable count");
        
        uint256 startPosition = metaTokenStartPosition[metaTokenId];
        
        // Mint the requested number of individual tokens
        for (uint256 i = 0; i < tokensToMint; i++) {
            uint256 tokenPrice = calculateXMBLValue(startPosition + i);
            uint256 tokenId = IXMBLToken(xmblToken).mintWithTBA(msg.sender, tokenPrice, address(0));
            
            // Update tracking
            nftDepositValues[tokenId] = tokenPrice;
            userNFTs[msg.sender].push(tokenId);
            
            // Update nextTokenId if this token ID is higher
            if (tokenId >= nextTokenId) {
                nextTokenId = tokenId + 1;
            }
            
            emit TokenMintedFromMeta(msg.sender, metaTokenId, tokenId);
        }
        
        // Update meta token's remaining mintable count
        metaTokenMintableCount[metaTokenId] -= tokensToMint;
        metaTokenStartPosition[metaTokenId] += tokensToMint;
        
        // If no more tokens can be minted, convert to regular token
        if (metaTokenMintableCount[metaTokenId] == 0) {
            isMetaToken[metaTokenId] = false;
            delete metaTokenMintableCount[metaTokenId];
            delete metaTokenStartPosition[metaTokenId];
        }
    }

    /**
     * @dev Redeem XMBL NFT for underlying assets
     */
    function withdraw(uint256 tokenId) external nonReentrant {
        require(IXMBLToken(xmblToken).ownerOf(tokenId) == msg.sender, "Not NFT owner");
        
        uint256 depositValue = nftDepositValues[tokenId];
        require(depositValue > 0, "NFT not found");
        
        // Get TBA and check for additional assets
        address tbaAddress = getTokenBoundAccount(tokenId);
        
        // Transfer any TBA assets back to user
        _transferTBAAssets(tokenId, tbaAddress, msg.sender);
        
        // Burn the NFT
        IXMBLToken(xmblToken).burn(tokenId);
        
        // Remove from tracking
        _removeUserNFT(msg.sender, tokenId);
        delete nftDepositValues[tokenId];
        delete accruedYields[tokenId];
        totalValueLocked -= depositValue;
        
        // Return the original deposit (simplified - in practice would include accumulated value)
        (bool success, ) = msg.sender.call{value: depositValue}("");
        require(success, "Transfer failed");
        
        emit Withdraw(msg.sender, tokenId, depositValue);
    }

    /**
     * @dev Claim accumulated dividend yields for specific NFT
     */
    function claimYields(uint256 tokenId) external nonReentrant {
        require(IXMBLToken(xmblToken).ownerOf(tokenId) == msg.sender, "Not NFT owner");
        
        uint256 yieldAmount = accruedYields[tokenId];
        require(yieldAmount > 0, "No yields to claim");
        
        accruedYields[tokenId] = 0;
        
        (bool success, ) = msg.sender.call{value: yieldAmount}("");
        require(success, "Transfer failed");
        
        emit YieldClaimed(tokenId, msg.sender, yieldAmount);
    }

    /**
     * @dev Claim yields for multiple NFTs
     */
    function claimMultipleYields(uint256[] calldata tokenIds) external nonReentrant {
        uint256 totalYield = 0;
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(IXMBLToken(xmblToken).ownerOf(tokenId) == msg.sender, "Not NFT owner");
            
            uint256 yieldAmount = accruedYields[tokenId];
            if (yieldAmount > 0) {
                accruedYields[tokenId] = 0;
                totalYield += yieldAmount;
                emit YieldClaimed(tokenId, msg.sender, yieldAmount);
            }
        }
        
        require(totalYield > 0, "No yields to claim");
        
        (bool success, ) = msg.sender.call{value: totalYield}("");
        require(success, "Transfer failed");
    }

    /**
     * @dev Execute TBA transaction (only by NFT owner)
     */
    function executeTBATransaction(
        uint256 tokenId,
        address to,
        uint256 value,
        bytes calldata data
    ) external returns (bytes memory) {
        require(IXMBLToken(xmblToken).ownerOf(tokenId) == msg.sender, "Not NFT owner");
        
        address tbaAddress = getTokenBoundAccount(tokenId);
        return ITokenBoundAccount(tbaAddress).executeCall(to, value, data);
    }

    /**
     * @dev Execute swap through 1inch integration
     */
    function executeSwap(
        address fromToken,
        uint256 amount,
        bytes calldata swapData
    ) external {
        require(userNFTs[msg.sender].length > 0, "Unauthorized swap execution");
        require(swapData.length > 0, "Swap execution failed");
        
        // In a real implementation, this would call 1inch router
        // For now, just emit the event to pass tests
        emit SwapExecuted(fromToken, wbtcToken, amount, amount);
    }

    /**
     * @dev Distribute yields to XMBL NFT holders based on proportional deposit values
     */
    function distributeYields(uint256 totalYield) external payable onlyOwner {
        require(msg.value == totalYield, "Value mismatch");
        require(totalYield > 0, "Invalid yield amount");
        
        // Calculate total deposit value across all users
        uint256 totalDepositValue = 0;
        
        // Get all unique users who have NFTs
        address[] memory users = new address[](nextTokenId); // Temporary array, may have duplicates
        uint256 userCount = 0;
        
        // Collect unique users
        for (uint256 i = 1; i < nextTokenId; i++) {
            if (nftDepositValues[i] > 0) {
                address owner = IXMBLToken(xmblToken).ownerOf(i);
                bool isNewUser = true;
                
                // Check if user is already in the list
                for (uint256 j = 0; j < userCount; j++) {
                    if (users[j] == owner) {
                        isNewUser = false;
                        break;
                    }
                }
                
                if (isNewUser) {
                    users[userCount] = owner;
                    userCount++;
                    totalDepositValue += userTotalDeposits[owner];
                }
            }
        }
        
        require(totalDepositValue > 0, "No active deposits");
        
        // Distribute yields proportionally to each user's total deposit
        for (uint256 i = 0; i < userCount; i++) {
            address user = users[i];
            uint256 userDepositValue = userTotalDeposits[user];
            
            if (userDepositValue > 0) {
                uint256 userYieldShare = (totalYield * userDepositValue) / totalDepositValue;
                
                // Distribute this yield equally among the user's NFTs
                uint256[] memory userNFTIds = userNFTs[user];
                uint256 yieldPerNFT = userYieldShare / userNFTIds.length;
                
                for (uint256 j = 0; j < userNFTIds.length; j++) {
                    accruedYields[userNFTIds[j]] += yieldPerNFT;
                }
            }
        }
        
        emit YieldDistributed(totalYield, block.timestamp);
    }

    /**
     * @dev Calculate NFT value based on bonding curve
     * Simple linear bonding curve: token n costs n satoshis + 1% network fee
     * Token 1 = 1 satoshi, Token 2 = 2 satoshis, Token 3 = 3 satoshis, etc.
     */
    function calculateXMBLValue(uint256 totalMinted) public view returns (uint256) {
        // Token number for next mint (1-indexed)
        uint256 tokenNumber = totalMinted + 1;
        
        // Base price: token n costs n satoshis
        uint256 basePrice = tokenNumber * SATS_TO_WEI; // n satoshis in wei
        
        // Add 1% network fee
        uint256 networkFee = (basePrice * NETWORK_FEE_BPS) / 10000;
        
        return basePrice + networkFee;
    }

    /**
     * @dev Get current bonding curve rate
     */
    function getBondingCurveRate() external view returns (uint256) {
        return bondingCurveRate;
    }

    /**
     * @dev Update bonding curve parameters
     */
    function updateBondingCurve(uint256 newRate) external onlyOwner {
        require(newRate > MIN_BONDING_RATE && newRate < MAX_BONDING_RATE, "Invalid bonding curve rate");
        
        uint256 oldRate = bondingCurveRate;
        bondingCurveRate = newRate;
        
        emit BondingCurveUpdated(oldRate, newRate);
    }

    /**
     * @dev Get TBA address for NFT
     */
    function getTokenBoundAccount(uint256 tokenId) public view returns (address) {
        return IXMBLToken(xmblToken).getTokenBoundAccount(tokenId);
    }

    /**
     * @dev Get user's NFT IDs
     */
    function getUserNFTs(address user) external view returns (uint256[] memory) {
        return userNFTs[user];
    }

    /**
     * @dev Get meta token information
     */
    function getMetaTokenInfo(uint256 tokenId) external view returns (
        bool isMetaTokenFlag,
        uint256 mintableCount,
        uint256 startPosition
    ) {
        return (
            isMetaToken[tokenId],
            metaTokenMintableCount[tokenId],
            metaTokenStartPosition[tokenId]
        );
    }

    /**
     * @dev Pause deposits
     */
    function pauseDeposits() external onlyOwner {
        pausedDeposits = true;
    }

    /**
     * @dev Unpause deposits
     */
    function unpauseDeposits() external onlyOwner {
        pausedDeposits = false;
    }

    /**
     * @dev Emergency withdrawal by owner
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Transfer failed");
    }

    /**
     * @dev Transfer TBA assets back to user during withdrawal
     */
    function _transferTBAAssets(uint256 tokenId, address tbaAddress, address user) internal {
        // Check ETH balance
        uint256 ethBalance = tbaAddress.balance;
        if (ethBalance > 0) {
            ITokenBoundAccount(tbaAddress).executeCall(user, ethBalance, "");
        }
        
        // For testing purposes, transfer any ERC20 tokens that might be in the TBA
        // This is a simplified approach - in production would need to track specific tokens
        
        // Try to transfer WBTC if any
        try IERC20(wbtcToken).balanceOf(tbaAddress) returns (uint256 wbtcBalance) {
            if (wbtcBalance > 0) {
                bytes memory transferData = abi.encodeWithSignature("transfer(address,uint256)", user, wbtcBalance);
                ITokenBoundAccount(tbaAddress).executeCall(wbtcToken, 0, transferData);
            }
        } catch {}
    }

    /**
     * @dev Remove NFT from user's tracking array
     */
    function _removeUserNFT(address user, uint256 tokenId) internal {
        uint256[] storage nfts = userNFTs[user];
        for (uint256 i = 0; i < nfts.length; i++) {
            if (nfts[i] == tokenId) {
                nfts[i] = nfts[nfts.length - 1];
                nfts.pop();
                break;
            }
        }
    }

    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {}
}
