// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract PrivacyPreservingVoterRegistry is SepoliaConfig {
    // Encrypted voter registration data
    struct EncryptedVoter {
        uint256 id;
        euint32 encryptedName;      // Encrypted name
        euint32 encryptedDOB;       // Encrypted date of birth
        euint32 encryptedIDNumber;  // Encrypted government ID number
        uint256 timestamp;
    }
    
    // Decrypted voter details (revealed only after verification)
    struct DecryptedVoter {
        string name;
        string dob;
        string idNumber;
        bool isVerified;
    }

    // Contract state
    uint256 public voterCount;
    mapping(uint256 => EncryptedVoter) public encryptedVoters;
    mapping(uint256 => DecryptedVoter) public decryptedVoters;

    // Track verification requests
    mapping(uint256 => uint256) private requestToVoterId;

    // Events
    event VoterRegistered(uint256 indexed id, uint256 timestamp);
    event VerificationRequested(uint256 indexed voterId);
    event VoterVerified(uint256 indexed voterId);

    modifier onlyVoter(uint256 voterId) {
        // In real implementation, check access control
        // e.g., require(msg.sender == voterOf[voterId], "Not voter");
        _;
    }

    /// @notice Submit a new encrypted voter registration
    function submitEncryptedVoter(
        euint32 encryptedName,
        euint32 encryptedDOB,
        euint32 encryptedIDNumber
    ) public {
        voterCount += 1;
        uint256 newId = voterCount;

        encryptedVoters[newId] = EncryptedVoter({
            id: newId,
            encryptedName: encryptedName,
            encryptedDOB: encryptedDOB,
            encryptedIDNumber: encryptedIDNumber,
            timestamp: block.timestamp
        });

        // Initialize decrypted state
        decryptedVoters[newId] = DecryptedVoter({
            name: "",
            dob: "",
            idNumber: "",
            isVerified: false
        });

        emit VoterRegistered(newId, block.timestamp);
    }

    /// @notice Request voter eligibility verification via FHE
    function requestVoterVerification(uint256 voterId) public onlyVoter(voterId) {
        EncryptedVoter storage voter = encryptedVoters[voterId];
        require(!decryptedVoters[voterId].isVerified, "Already verified");

        bytes32 ;
        ciphertexts[0] = FHE.toBytes32(voter.encryptedName);
        ciphertexts[1] = FHE.toBytes32(voter.encryptedDOB);
        ciphertexts[2] = FHE.toBytes32(voter.encryptedIDNumber);

        // Request FHE verification and callback
        uint256 reqId = FHE.requestDecryption(ciphertexts, this.verifyVoter.selector);
        requestToVoterId[reqId] = voterId;

        emit VerificationRequested(voterId);
    }

    /// @notice Callback for decrypted voter verification
    function verifyVoter(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 voterId = requestToVoterId[requestId];
        require(voterId != 0, "Invalid request");

        // Verify FHE proof
        FHE.checkSignatures(requestId, cleartexts, proof);

        // Decode decrypted voter data
        string[] memory results = abi.decode(cleartexts, (string[]));
        DecryptedVoter storage dVoter = decryptedVoters[voterId];

        dVoter.name = results[0];
        dVoter.dob = results[1];
        dVoter.idNumber = results[2];
        dVoter.isVerified = true;

        emit VoterVerified(voterId);
    }

    /// @notice Get decrypted voter details
    function getDecryptedVoter(uint256 voterId) public view returns (
        string memory name,
        string memory dob,
        string memory idNumber,
        bool isVerified
    ) {
        DecryptedVoter storage v = decryptedVoters[voterId];
        return (v.name, v.dob, v.idNumber, v.isVerified);
    }
}
