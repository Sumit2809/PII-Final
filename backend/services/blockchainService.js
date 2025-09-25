import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// --- 1. Initial Setup: Provider, Wallet, and Contract ABI ---

// Establish connection to the Polygon network
const provider = new ethers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC_URL);

// Create a wallet instance from your private key to sign transactions
const wallet = new ethers.Wallet(process.env.CONTRACT_OWNER_PRIVATE_KEY, provider);

// Load the contract's ABI (Application Binary Interface)
// The ABI is like a menu of functions that tells our script how to interact with the contract.
const contractJson = JSON.parse(fs.readFileSync('./contracts/compiled.json', 'utf8')); // We'll create this file next
const contractAbi = contractJson.contracts['AuditTrail.sol']['AuditTrail'].abi;
const contractAddress = process.env.SMART_CONTRACT_ADDRESS;

// Create a contract instance
const auditTrailContract = new ethers.Contract(contractAddress, contractAbi, wallet);

console.log(`🔗 Blockchain service connected to contract at: ${contractAddress}`);


// --- 2. Service Functions: Interacting with the Smart Contract ---

/**
 * @dev Logs a new document's hash to the blockchain.
 * @param {string} fileHash - The SHA-256 hash of the redacted document.
 * @param {string} userAddress - The user's wallet address (can be a placeholder for now).
 * @returns {Promise<string>} The blockchain transaction hash.
 */
export const logDocumentCreation = async (fileHash, userAddress) => {
  try {
    // Note: For this project, we'll use the owner's address for simplicity.
    // In a production system, you might map your app's users to blockchain addresses.
    const tx = await auditTrailContract.logNewDocument(fileHash, wallet.address);
    await tx.wait(); // Wait for the transaction to be mined
    console.log(`✅ Document creation logged on blockchain. Tx: ${tx.hash}`);
    return tx.hash;
  } catch (error) {
    console.error('❌ Error logging document creation on blockchain:', error);
    throw new Error('Blockchain transaction failed.');
  }
};

/**
 * @dev Logs an access event for a document to the blockchain.
 * @param {string} fileHash - The SHA-256 hash of the document being accessed.
 * @param {string} accessorAddress - The wallet address of the user accessing the file.
 * @returns {Promise<string>} The blockchain transaction hash.
 */
export const logDocumentAccess = async (fileHash, accessorAddress) => {
  try {
    const tx = await auditTrailContract.logAccess(fileHash, wallet.address);
    await tx.wait();
    console.log(`✅ Document access logged on blockchain. Tx: ${tx.hash}`);
    return tx.hash;
  } catch (error) {
    console.error('❌ Error logging document access on blockchain:', error);
    throw new Error('Blockchain transaction failed.');
  }
};

/**
 * @dev Verifies a document's hash against the one stored on the blockchain.
 * @param {string} fileHash - The hash of the local file to verify.
 * @returns {Promise<boolean>} True if the hashes match, false otherwise.
 */
export const verifyDocumentIntegrity = async (fileHash) => {
  try {
    const documentRecord = await auditTrailContract.getDocumentRecord(fileHash);
    // The contract returns a struct; the hash is the first element.
    const onChainHash = documentRecord[0];
    return onChainHash === fileHash;
  } catch (error) {
    console.error('❌ Error verifying document integrity:', error);
    return false;
  }
};

/**
 * @dev Retrieves the full access history for a document from the blockchain.
 * @param {string} fileHash - The hash of the document.
 * @returns {Promise<Array>} An array of access log objects.
 */
export const getDocumentAccessHistory = async (fileHash) => {
  try {
    const history = await auditTrailContract.getAccessHistory(fileHash);
    // The contract returns an array of structs. We can map it to a more friendly format.
    return history.map(log => ({
      accessor: log.accessor,
      timestamp: new Date(Number(log.timestamp) * 1000).toISOString(),
    }));
  } catch (error) {
    console.error('❌ Error retrieving access history:', error);
    return [];
  }
};