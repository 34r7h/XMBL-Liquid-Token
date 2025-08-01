// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IWormholeBridge
 * @dev Interface for Wormhole bridge interactions for cross-chain WBTC to native BTC bridging
 * 
 * PURPOSE:
 * Defines interface for Wormhole bridge protocol interactions, enabling secure
 * cross-chain transfers of WBTC from Ethereum to native Bitcoin network with
 * cryptographic verification and decentralized validation.
 * 
 * MAIN FUNCTIONS:
 * - transferTokens(address token, uint256 amount, uint16 recipientChain, bytes32 recipient, uint256 arbiterFee, uint32 nonce) external payable returns (uint64)
 *   * Initiates cross-chain token transfer
 *   * Arguments: token address, amount, target chain ID, recipient address, arbiter fee, nonce
 *   * Returns: sequence number for tracking
 * 
 * - completeTransfer(bytes memory encodedVm) external
 *   * Completes incoming transfer with signed VAA
 *   * Arguments: encoded Verifiable Action Approval (VAA)
 * 
 * - parseTransfer(bytes memory encoded) external pure returns (TransferDetails memory)
 *   * Parses transfer payload data
 *   * Arguments: encoded transfer data
 *   * Returns: structured transfer details
 * 
 * - attestToken(address tokenAddress, uint32 nonce) external payable returns (uint64)
 *   * Attests token for cross-chain use
 *   * Arguments: token contract address, nonce
 *   * Returns: sequence number
 * 
 * - createWrapped(bytes memory encodedVm) external returns (address)
 *   * Creates wrapped token on target chain
 *   * Arguments: encoded VAA with token attestation
 *   * Returns: wrapped token address
 * 
 * - updateWrapped(bytes memory encodedVm) external returns (address)
 *   * Updates wrapped token metadata
 *   * Arguments: encoded VAA with updated metadata
 *   * Returns: wrapped token address
 * 
 * - wrapperForTokenOnChain(uint16 tokenChain, bytes32 tokenAddress) external view returns (address)
 *   * Gets wrapped token address for native token
 *   * Arguments: origin chain ID, native token address
 *   * Returns: wrapped token contract address
 * 
 * - isTransferCompleted(bytes32 hash) external view returns (bool)
 *   * Checks if transfer has been completed
 *   * Arguments: transfer hash
 *   * Returns: completion status
 * 
 * STRUCTS:
 * - TransferDetails: {
 *     uint8 payloadID,
 *     uint256 amount,
 *     bytes32 tokenAddress,
 *     uint16 tokenChain,
 *     bytes32 to,
 *     uint16 toChain,
 *     uint256 fee
 *   }
 * 
 * EVENTS:
 * - LogTokensLocked(address indexed token, address indexed sender, uint256 amount, uint16 recipientChain, bytes32 recipient)
 * - TransferRedeemed(address indexed token, address indexed to, uint256 amount, uint16 fromChain)
 * - TokenAttestation(address indexed token, uint16 chain, bytes32 tokenAddress)
 * 
 * REQUIREMENTS:
 * - Must support WBTC to native BTC bridging
 * - Must provide cryptographic proof verification
 * - Must handle cross-chain message validation
 * - Must support both token transfers and attestations
 * - Must maintain decentralized guardian network validation
 * - Must provide finality guarantees for transfers
 * 
 * CONNECTED SYSTEM COMPONENTS:
 * - XMBLVault.sol - May bridge WBTC to Bitcoin for yield deployment
 * - server/bitcoinService.ts - Coordinates Bitcoin-side operations
 * - YieldManager.sol - May bridge funds for Bitcoin yield opportunities
 * - EthereumHTLC.sol - Alternative to Wormhole for atomic swaps
 * 
 * BRIDGE FLOW:
 * 1. Lock tokens on source chain
 * 2. Guardian network observes and signs VAA
 * 3. VAA submitted to target chain for redemption
 * 4. Tokens minted/released on target chain
 * 
 * SECURITY FEATURES:
 * - Multi-signature validation from guardian network
 * - Cryptographic proof verification
 * - Time-locked emergency procedures
 * - Governance-controlled upgrades
 * - Replay protection mechanisms
 * 
 * BITCOIN INTEGRATION:
 * - WBTC locking on Ethereum side
 * - Native BTC release on Bitcoin side
 * - SPV proof verification for Bitcoin confirmations
 * - Multi-signature custody for Bitcoin holdings
 * 
 * FEE STRUCTURE:
 * - Gas fees for transaction execution
 * - Bridge fees for guardian network
 * - Relayer fees for VAA submission
 * - Variable fees based on target chain
 */
interface IWormholeBridge {
    
    // Structs
    struct TransferDetails {
        uint8 payloadID;
        uint256 amount;
        bytes32 tokenAddress;
        uint16 tokenChain;
        bytes32 to;
        uint16 toChain;
        uint256 fee;
    }
    
    // Events
    event LogTokensLocked(
        address indexed token,
        address indexed sender,
        uint256 amount,
        uint16 recipientChain,
        bytes32 recipient
    );
    
    event TransferRedeemed(
        address indexed token,
        address indexed to,
        uint256 amount,
        uint16 fromChain
    );
    
    event TokenAttestation(
        address indexed token,
        uint16 chain,
        bytes32 tokenAddress
    );
    
    event TransferInitiated(
        bytes32 indexed transferHash,
        address indexed token,
        uint256 amount,
        uint16 recipientChain,
        bytes32 recipient
    );
    
    /**
     * @dev Initiates cross-chain token transfer
     * @param token Token address
     * @param amount Transfer amount
     * @param recipientChain Target chain ID
     * @param recipient Recipient address
     * @param arbiterFee Arbiter fee
     * @param nonce Nonce for uniqueness
     * @return sequence Sequence number for tracking
     */
    function transferTokens(
        address token,
        uint256 amount,
        uint16 recipientChain,
        bytes32 recipient,
        uint256 arbiterFee,
        uint32 nonce
    ) external payable returns (uint64 sequence);
    
    /**
     * @dev Completes incoming transfer with signed VAA
     * @param encodedVm Encoded Verifiable Action Approval (VAA)
     */
    function completeTransfer(bytes memory encodedVm) external;
    
    /**
     * @dev Parses transfer payload data
     * @param encoded Encoded transfer data
     * @return details Structured transfer details
     */
    function parseTransfer(bytes memory encoded) external pure returns (TransferDetails memory details);
    
    /**
     * @dev Attests token for cross-chain use
     * @param tokenAddress Token contract address
     * @param nonce Nonce for uniqueness
     * @return sequence Sequence number
     */
    function attestToken(address tokenAddress, uint32 nonce) external payable returns (uint64 sequence);
    
    /**
     * @dev Creates wrapped token on target chain
     * @param encodedVm Encoded VAA with token attestation
     * @return wrappedToken Wrapped token address
     */
    function createWrapped(bytes memory encodedVm) external returns (address wrappedToken);
    
    /**
     * @dev Updates wrapped token metadata
     * @param encodedVm Encoded VAA with updated metadata
     * @return wrappedToken Wrapped token address
     */
    function updateWrapped(bytes memory encodedVm) external returns (address wrappedToken);
    
    /**
     * @dev Gets wrapped token address for native token
     * @param tokenChain Origin chain ID
     * @param tokenAddress Native token address
     * @return wrapper Wrapped token contract address
     */
    function wrapperForTokenOnChain(uint16 tokenChain, bytes32 tokenAddress) external view returns (address wrapper);
    
    /**
     * @dev Checks if transfer has been completed
     * @param hash Transfer hash
     * @return completed Completion status
     */
    function isTransferCompleted(bytes32 hash) external view returns (bool completed);
    
    /**
     * @dev Gets guardian network information
     * @return guardianCount Number of active guardians
     * @return quorum Required guardian signatures
     */
    function getGuardianInfo() external view returns (uint256 guardianCount, uint256 quorum);
    
    /**
     * @dev Validates VAA signature
     * @param vaa Encoded VAA
     * @return isValid True if VAA is valid
     */
    function verifyVAA(bytes memory vaa) external view returns (bool isValid);
    
    /**
     * @dev Gets bridge fee for transfer
     * @param token Token address
     * @param amount Transfer amount
     * @param targetChain Target chain ID
     * @return fee Bridge fee amount
     */
    function getBridgeFee(address token, uint256 amount, uint16 targetChain) external view returns (uint256 fee);
}
