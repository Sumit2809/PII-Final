// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AuditTrail
 * @dev This contract stores immutable audit logs for documents.
 * It links a document's SHA-256 hash to a creation event and subsequent access events.
 */
contract AuditTrail {
    
    // --- State Variables ---

    address public owner;

    struct DocumentLog {
        string fileHash;      // The SHA-256 hash of the redacted document
        address user;         // The wallet address of the user who saved it
        uint256 timestamp;    // The block timestamp of the creation event
    }

    struct AccessLog {
        address accessor;     // The wallet address of the user who accessed it
        uint256 timestamp;    // The block timestamp of the access event
    }

    // Mapping: fileHash => DocumentLog (to store the initial creation record)
    mapping(string => DocumentLog) public documentRecords;

    // Mapping: fileHash => AccessLog[] (to store the history of all accesses)
    mapping(string => AccessLog[]) public accessHistory;

    // --- Events ---

    event DocumentCreated(
        string indexed fileHash,
        address indexed user,
        uint256 timestamp
    );

    event DocumentAccessed(
        string indexed fileHash,
        address indexed accessor,
        uint256 timestamp
    );

    // --- Modifiers ---

    modifier onlyOwner() {
        require(msg.sender == owner, "AuditTrail: Caller is not the owner");
        _;
    }

    // --- Constructor ---

    constructor() {
        owner = msg.sender; // The account that deploys the contract is the owner
    }

    // --- Functions ---

    /**
     * @dev Records the creation of a new, redacted document.
     * Only one record can be created per file hash.
     * @param _fileHash The SHA-256 hash of the redacted document.
     * @param _user The address of the user saving the document.
     */
    function logNewDocument(string memory _fileHash, address _user) external onlyOwner {
        // Ensure this document hash hasn't been logged before
        require(documentRecords[_fileHash].timestamp == 0, "AuditTrail: Document hash already exists");

        documentRecords[_fileHash] = DocumentLog({
            fileHash: _fileHash,
            user: _user,
            timestamp: block.timestamp
        });

        emit DocumentCreated(_fileHash, _user, block.timestamp);
    }

    /**
     * @dev Records an access event for an existing document.
     * @param _fileHash The SHA-256 hash of the document being accessed.
     * @param _accessor The address of the user accessing the document.
     */
    function logAccess(string memory _fileHash, address _accessor) external onlyOwner {
        // Ensure the document exists before logging an access event
        require(documentRecords[_fileHash].timestamp != 0, "AuditTrail: Document does not exist");

        accessHistory[_fileHash].push(AccessLog({
            accessor: _accessor,
            timestamp: block.timestamp
        }));

        emit DocumentAccessed(_fileHash, _accessor, block.timestamp);
    }

    /**
     * @dev Retrieves the initial creation log for a document.
     * @param _fileHash The hash of the document to verify.
     * @return The DocumentLog struct containing the original hash, user, and timestamp.
     */
    function getDocumentRecord(string memory _fileHash) external view returns (DocumentLog memory) {
        return documentRecords[_fileHash];
    }

    /**
     * @dev Retrieves the complete access history for a document.
     * @param _fileHash The hash of the document.
     * @return An array of AccessLog structs.
     */
    function getAccessHistory(string memory _fileHash) external view returns (AccessLog[] memory) {
        return accessHistory[_fileHash];
    }
}