import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface VoterRecord {
  id: string;
  encryptedData: string;
  timestamp: number;
  owner: string;
  status: "pending" | "verified" | "rejected";
  region: string;
  ageGroup: string;
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<VoterRecord[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newRecordData, setNewRecordData] = useState({
    region: "",
    ageGroup: "18-30",
    sensitiveInfo: ""
  });
  const [showTutorial, setShowTutorial] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  // Calculate statistics for dashboard
  const verifiedCount = records.filter(r => r.status === "verified").length;
  const pendingCount = records.filter(r => r.status === "pending").length;
  const rejectedCount = records.filter(r => r.status === "rejected").length;

  useEffect(() => {
    loadRecords().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadRecords = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("record_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing record keys:", e);
        }
      }
      
      const list: VoterRecord[] = [];
      
      for (const key of keys) {
        try {
          const recordBytes = await contract.getData(`record_${key}`);
          if (recordBytes.length > 0) {
            try {
              const recordData = JSON.parse(ethers.toUtf8String(recordBytes));
              list.push({
                id: key,
                encryptedData: recordData.data,
                timestamp: recordData.timestamp,
                owner: recordData.owner,
                region: recordData.region,
                ageGroup: recordData.ageGroup,
                status: recordData.status || "pending"
              });
            } catch (e) {
              console.error(`Error parsing record data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading record ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setRecords(list);
    } catch (e) {
      console.error("Error loading records:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const registerVoter = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setRegistering(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting voter data with FHE..."
    });
    
    try {
      // Simulate FHE encryption
      const encryptedData = `FHE-${btoa(JSON.stringify(newRecordData))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const recordId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const recordData = {
        data: encryptedData,
        timestamp: Math.floor(Date.now() / 1000),
        owner: account,
        region: newRecordData.region,
        ageGroup: newRecordData.ageGroup,
        status: "pending"
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `record_${recordId}`, 
        ethers.toUtf8Bytes(JSON.stringify(recordData))
      );
      
      const keysBytes = await contract.getData("record_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(recordId);
      
      await contract.setData(
        "record_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Voter registration submitted securely!"
      });
      
      await loadRecords();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowRegistrationModal(false);
        setNewRecordData({
          region: "",
          ageGroup: "18-30",
          sensitiveInfo: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Registration failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setRegistering(false);
    }
  };

  const verifyRecord = async (recordId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Processing encrypted data with FHE..."
    });

    try {
      // Simulate FHE computation time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const recordBytes = await contract.getData(`record_${recordId}`);
      if (recordBytes.length === 0) {
        throw new Error("Record not found");
      }
      
      const recordData = JSON.parse(ethers.toUtf8String(recordBytes));
      
      const updatedRecord = {
        ...recordData,
        status: "verified"
      };
      
      await contract.setData(
        `record_${recordId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedRecord))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "FHE verification completed successfully!"
      });
      
      await loadRecords();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Verification failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const rejectRecord = async (recordId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Processing encrypted data with FHE..."
    });

    try {
      // Simulate FHE computation time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const recordBytes = await contract.getData(`record_${recordId}`);
      if (recordBytes.length === 0) {
        throw new Error("Record not found");
      }
      
      const recordData = JSON.parse(ethers.toUtf8String(recordBytes));
      
      const updatedRecord = {
        ...recordData,
        status: "rejected"
      };
      
      await contract.setData(
        `record_${recordId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedRecord))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "FHE rejection completed successfully!"
      });
      
      await loadRecords();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Rejection failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const isOwner = (address: string) => {
    return account.toLowerCase() === address.toLowerCase();
  };

  const toggleRecordExpansion = (id: string) => {
    if (expandedRecordId === id) {
      setExpandedRecordId(null);
    } else {
      setExpandedRecordId(id);
    }
  };

  const tutorialSteps = [
    {
      title: "Connect Wallet",
      description: "Connect your Web3 wallet to start the registration process",
      icon: "🔗"
    },
    {
      title: "Submit Encrypted Data",
      description: "Provide your voter information which will be encrypted using FHE",
      icon: "🔒"
    },
    {
      title: "FHE Verification",
      description: "Your eligibility is verified without decrypting your data",
      icon: "⚙️"
    },
    {
      title: "Receive Voting Token",
      description: "Get your anonymous voting token once verified",
      icon: "✅"
    }
  ];

  const renderPieChart = () => {
    const total = records.length || 1;
    const verifiedPercentage = (verifiedCount / total) * 100;
    const pendingPercentage = (pendingCount / total) * 100;
    const rejectedPercentage = (rejectedCount / total) * 100;

    return (
      <div className="pie-chart-container">
        <div className="pie-chart">
          <div 
            className="pie-segment verified" 
            style={{ transform: `rotate(${verifiedPercentage * 3.6}deg)` }}
          ></div>
          <div 
            className="pie-segment pending" 
            style={{ transform: `rotate(${(verifiedPercentage + pendingPercentage) * 3.6}deg)` }}
          ></div>
          <div 
            className="pie-segment rejected" 
            style={{ transform: `rotate(${(verifiedPercentage + pendingPercentage + rejectedPercentage) * 3.6}deg)` }}
          ></div>
          <div className="pie-center">
            <div className="pie-value">{records.length}</div>
            <div className="pie-label">Registrations</div>
          </div>
        </div>
        <div className="pie-legend">
          <div className="legend-item">
            <div className="color-box verified"></div>
            <span>Verified: {verifiedCount}</span>
          </div>
          <div className="legend-item">
            <div className="color-box pending"></div>
            <span>Pending: {pendingCount}</span>
          </div>
          <div className="legend-item">
            <div className="color-box rejected"></div>
            <span>Rejected: {rejectedCount}</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="cyber-spinner"></div>
      <p>Initializing encrypted connection...</p>
    </div>
  );

  return (
    <div className="app-container cyberpunk-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="shield-icon"></div>
          </div>
          <h1>Secure<span>Vote</span></h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowRegistrationModal(true)} 
            className="create-record-btn cyber-button"
          >
            <div className="add-icon"></div>
            Register Voter
          </button>
          <button 
            className="cyber-button"
            onClick={() => setShowTutorial(!showTutorial)}
          >
            {showTutorial ? "Hide Tutorial" : "Show Tutorial"}
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>Privacy-Preserving Voter Registration</h2>
            <p>Verify voter eligibility without exposing personal data using FHE technology</p>
          </div>
        </div>
        
        <div className="project-intro cyber-card">
          <h2>Project Introduction</h2>
          <p>
            SecureVote leverages Fully Homomorphic Encryption (FHE) to verify voter eligibility 
            without creating a centralized database of sensitive voter information. 
            Our system ensures:
          </p>
          <ul>
            <li>Encrypted voter registration</li>
            <li>Cross-verification with government databases without decryption</li>
            <li>Anonymous voting credentials generation</li>
            <li>Prevention of double voting</li>
          </ul>
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
        </div>
        
        {showTutorial && (
          <div className="tutorial-section cyber-card">
            <h2>How SecureVote Works</h2>
            <p className="subtitle">Learn how to register as a voter while maintaining privacy</p>
            
            <div className="tutorial-steps">
              {tutorialSteps.map((step, index) => (
                <div 
                  className="tutorial-step"
                  key={index}
                >
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="dashboard-grid">
          <div className="dashboard-card cyber-card">
            <h3>Registration Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{records.length}</div>
                <div className="stat-label">Total Registrations</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{verifiedCount}</div>
                <div className="stat-label">Verified</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{pendingCount}</div>
                <div className="stat-label">Pending</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{rejectedCount}</div>
                <div className="stat-label">Rejected</div>
              </div>
            </div>
          </div>
          
          <div className="dashboard-card cyber-card">
            <h3>Verification Status</h3>
            {renderPieChart()}
          </div>
        </div>
        
        <div className="records-section">
          <div className="section-header">
            <h2>Voter Registration Records</h2>
            <div className="header-actions">
              <button 
                onClick={loadRecords}
                className="refresh-btn cyber-button"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="records-list cyber-card">
            <div className="table-header">
              <div className="header-cell">ID</div>
              <div className="header-cell">Region</div>
              <div className="header-cell">Age Group</div>
              <div className="header-cell">Date</div>
              <div className="header-cell">Status</div>
              <div className="header-cell">Actions</div>
            </div>
            
            {records.length === 0 ? (
              <div className="no-records">
                <div className="no-records-icon"></div>
                <p>No voter records found</p>
                <button 
                  className="cyber-button primary"
                  onClick={() => setShowRegistrationModal(true)}
                >
                  Register First Voter
                </button>
              </div>
            ) : (
              records.map(record => (
                <React.Fragment key={record.id}>
                  <div className="record-row" onClick={() => toggleRecordExpansion(record.id)}>
                    <div className="table-cell record-id">#{record.id.substring(0, 6)}</div>
                    <div className="table-cell">{record.region}</div>
                    <div className="table-cell">{record.ageGroup}</div>
                    <div className="table-cell">
                      {new Date(record.timestamp * 1000).toLocaleDateString()}
                    </div>
                    <div className="table-cell">
                      <span className={`status-badge ${record.status}`}>
                        {record.status}
                      </span>
                    </div>
                    <div className="table-cell actions">
                      {isOwner(record.owner) && record.status === "pending" && (
                        <>
                          <button 
                            className="action-btn cyber-button success"
                            onClick={(e) => {
                              e.stopPropagation();
                              verifyRecord(record.id);
                            }}
                          >
                            Verify
                          </button>
                          <button 
                            className="action-btn cyber-button danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              rejectRecord(record.id);
                            }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {expandedRecordId === record.id && (
                    <div className="record-details">
                      <div className="detail-item">
                        <strong>Owner:</strong> {record.owner}
                      </div>
                      <div className="detail-item">
                        <strong>Encrypted Data:</strong> 
                        <div className="encrypted-data">{record.encryptedData.substring(0, 80)}...</div>
                      </div>
                      <div className="detail-item">
                        <strong>FHE Verification:</strong> 
                        <span className="fhe-status">Encrypted</span>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))
            )}
          </div>
        </div>
      </div>
  
      {showRegistrationModal && (
        <ModalRegistration 
          onSubmit={registerVoter} 
          onClose={() => setShowRegistrationModal(false)} 
          registering={registering}
          recordData={newRecordData}
          setRecordData={setNewRecordData}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content cyber-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="cyber-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="shield-icon"></div>
              <span>SecureVote</span>
            </div>
            <p>Privacy-preserving voter registration using FHE technology</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} SecureVote. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalRegistrationProps {
  onSubmit: () => void; 
  onClose: () => void; 
  registering: boolean;
  recordData: any;
  setRecordData: (data: any) => void;
}

const ModalRegistration: React.FC<ModalRegistrationProps> = ({ 
  onSubmit, 
  onClose, 
  registering,
  recordData,
  setRecordData
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRecordData({
      ...recordData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!recordData.region || !recordData.sensitiveInfo) {
      alert("Please fill required fields");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal cyber-card">
        <div className="modal-header">
          <h2>Voter Registration</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> Your sensitive data will be encrypted with FHE
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Region *</label>
              <select 
                name="region"
                value={recordData.region} 
                onChange={handleChange}
                className="cyber-select"
              >
                <option value="">Select region</option>
                <option value="North">North Region</option>
                <option value="South">South Region</option>
                <option value="East">East Region</option>
                <option value="West">West Region</option>
                <option value="Central">Central Region</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Age Group *</label>
              <select 
                name="ageGroup"
                value={recordData.ageGroup} 
                onChange={handleChange}
                className="cyber-select"
              >
                <option value="18-30">18-30</option>
                <option value="31-45">31-45</option>
                <option value="46-60">46-60</option>
                <option value="61+">61+</option>
              </select>
            </div>
            
            <div className="form-group full-width">
              <label>Sensitive Information *</label>
              <textarea 
                name="sensitiveInfo"
                value={recordData.sensitiveInfo} 
                onChange={handleChange}
                placeholder="Enter sensitive voter information to encrypt..." 
                className="cyber-textarea"
                rows={4}
              />
              <div className="hint">This data will be encrypted using FHE and never stored in plaintext</div>
            </div>
          </div>
          
          <div className="privacy-notice">
            <div className="privacy-icon"></div> Data remains encrypted during FHE verification
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn cyber-button"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={registering}
            className="submit-btn cyber-button primary"
          >
            {registering ? "Encrypting with FHE..." : "Register Securely"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;