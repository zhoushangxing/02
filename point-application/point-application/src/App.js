import './App.css'

import { ethers } from 'ethers'
import React, { useEffect, useState } from 'react'
 
// 导入 ABI
import PointsExchangeABI from './abis/PointsExchange.json'
import RegularPointsABI from './abis/RegularPoints.json'
import UniversalPointsABI from './abis/UniversalPoints.json'

//  合约地址
const UNIVERSAL_POINTS_ADDRESS = "0xF44Ed8DCEBb9eb24F49DF5Fbf423F5830bB43c6b";
const POINTS_EXCHANGE_ADDRESS  = "0x27291A0FC18F076C0d44f936858F864F10769138";

// 合约所有者私钥（保存在 .env 文件中）
const contractOwnerPrivateKey = process.env.REACT_APP_PRIVATE_KEY;

const deployRegularPoints = async (signer, name, symbol) => {
  // 合约部署函数
  const RegularPointsFactory = new ethers.ContractFactory(
    RegularPointsABI.abi,  // ABI
    RegularPointsABI.bytecode, // 合约字节码
    signer // 使用 signer 发送交易
  );

  try {
    const regularPoints = await RegularPointsFactory.deploy(name, symbol);
    console.log("RegularPoints contract deployed to:", regularPoints.address);
    return regularPoints.address;
  } catch (error) {
    console.error("Deployment failed:", error);
  }
};

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  const [isWalletConnected, setIsWalletConnected] = useState(false); // 钱包连接状态

  const [regularPointsContract, setRegularPointsContract] = useState(null);
  const [universalPointsContract, setUniversalPointsContract] = useState(null);
  const [pointsExchangeContract, setPointsExchangeContract] = useState(null);

  const [amountToMint, setAmountToMint] = useState('');
  const [userPointsBalance, setUserPointsBalance] = useState('0');
  const [universalPointsBalance, setUniversalPointsBalance] = useState('0'); // 通用积分余额

  const [regularPointsAddress, setRegularPointsAddress] = useState(''); // 用户输入的合约地址
  
  const [exchangeRate, setExchangeRate] = useState('1');  // 默认兑换比例：1:1

  const [name, setName] = useState("");  // 用户输入的合约名称
  const [symbol, setSymbol] = useState("");  // 用户输入的合约符号

  // 连接到 MetaMask
  const connectWallet = async () => {
    if (window.ethereum) {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const newProvider = new ethers.providers.Web3Provider(window.ethereum);
      const newSigner = newProvider.getSigner();
      const newAccount = await newSigner.getAddress();
      setAccount(newAccount);
      setProvider(newProvider);
      setSigner(newSigner);
      setIsWalletConnected(true);
    } else {
      alert('Please install MetaMask!');
    }
  };

  useEffect(() => {
    if (provider && signer) {
      const loadContracts = async () => {
        // 加载通用积分合约（UniversalPoints）
        const universalPoints = new ethers.Contract(UNIVERSAL_POINTS_ADDRESS, UniversalPointsABI.abi, signer);
        setUniversalPointsContract(universalPoints);

        // 加载积分兑换合约（PointsExchange）
        const pointsExchange = new ethers.Contract(POINTS_EXCHANGE_ADDRESS, PointsExchangeABI.abi, signer);
        setPointsExchangeContract(pointsExchange);

        // 获取通用积分余额
        const universalBalance = await universalPoints.balanceOf(account);
        setUniversalPointsBalance(ethers.utils.formatUnits(universalBalance, 18)); // 格式化并更新余额
      };
      loadContracts();
    }
  }, [provider, signer, account]);

    // 加载普通积分合约
    const loadRegularPointsContract = async (address) => {
      if (!ethers.utils.isAddress(address)) {
        alert('Invalid contract address');
        return;
      }
      try {
        const contract = new ethers.Contract(address, RegularPointsABI.abi, signer);
        const balance = await contract.balanceOf(account);
        setRegularPointsContract(contract);
        setUserPointsBalance(ethers.utils.formatUnits(balance, 18));
      } catch (error) {
        console.error("导入合约失败！", error);
        alert('导入合约失败！');
      }
    };
  
    // 处理用户输入合约地址
    const handleLoadContract = () => {
      if (regularPointsAddress) {
        loadRegularPointsContract(regularPointsAddress);
      } else {
        alert('请输入要导入的普通积分合约地址');
      }
    };

  // 查询当前账户的积分余额
  const getPointsBalance = async () => {
    if (universalPointsContract && regularPointsContract && account) {
      // 获取通用积分余额
      const universalBalance = await universalPointsContract.balanceOf(account);
      setUniversalPointsBalance(ethers.utils.formatUnits(universalBalance, 18));

      // 获取普通积分余额
      const regularBalance = await regularPointsContract.balanceOf(account);
      setUserPointsBalance(ethers.utils.formatUnits(regularBalance, 18));
    }
  };

  // 发行普通积分
  const issueRegularPoints = async () => {
    if (!amountToMint) {
      alert('Please enter the amount to mint');
      return;
    }
    const mintAmount = ethers.utils.parseUnits(amountToMint, 18);
    try {
      console.log(account);
      
      const tx = await regularPointsContract.mint(account, mintAmount);
      console.log(account);
      await tx.wait();
      alert(`成功发行 ${amountToMint} ${symbol}积分!`);
      getPointsBalance();
    } catch (err) {
      console.error(err);
      alert('发行失败！');
    }
  };

  const exchangePoints = async () => {
    // 检查普通积分合约地址是否存在，导入普通积分合约地址
    if (!regularPointsAddress) {
      // return;
      loadRegularPointsContract(regularPointsContract.address);
    }
    try {
      // 检查并设置兑换比例
      const rate = await pointsExchangeContract.exchangeRates(regularPointsContract.address);  // 获取兑换比例
      if (rate.eq(0)) { 
        const newRate = prompt('请输入新的兑换比例 (例如：1 RPT = 2 UPT)');
        if (!newRate || isNaN(newRate)) {
          alert('请输入有效的兑换比例');
          return;
        }
        setExchangeRate(newRate);
        const txRate = await pointsExchangeContract.setExchangeRate(regularPointsContract.address, ethers.BigNumber.from(newRate));
        await txRate.wait();  // 等待交易确认
        alert(`兑换比例已设置为 1 RPT = ${newRate} UPT`);
      }
      
      // 获取要兑换的普通积分数量
      const amountToExchange = prompt('输入要兑换的普通积分数量:');
      if (!amountToExchange || isNaN(amountToExchange)) {
        alert('请输入有效的兑换数量');
        return;
      }
      // 将输入的数量转换为合适的单位（假设单位是18）
      const exchangeAmount = ethers.utils.parseUnits(amountToExchange, 18);
      // 授权
      // 需要确保 `addMinter` 由合约所有者来调用`
      const ownerWallet = new ethers.Wallet(contractOwnerPrivateKey, provider);  // 使用合约所有者私钥
      const universalPointsWithOwner = new ethers.Contract(UNIVERSAL_POINTS_ADDRESS, UniversalPointsABI.abi, ownerWallet);
      
      // 授权 pointsExchange 合约为 Minter
      const txAddMinter = await universalPointsWithOwner.addMinter(pointsExchangeContract.address);
      await txAddMinter.wait();  // 等待交易确认

      // await universalPointsContract.addMinter(pointsExchangeContract.address);
      await regularPointsContract.approve(pointsExchangeContract.address,exchangeAmount);
      const tx = await pointsExchangeContract.exchangeRPTToUPT(regularPointsContract.address, exchangeAmount);
      await tx.wait();  // 等待交易确认
      alert('兑换成功！');
    } catch (err) {
      console.error('兑换失败:', err);
      alert('兑换失败！');
    }
  };
 
    // 部署合约
  const handleDeploy = async () => {
    if (!name || !symbol) {
      alert("请输入积分的名字和代号");
      return;
    }
    if (signer) {
      const contractAddress = await deployRegularPoints(signer, name, symbol);
      alert(`合约地址: ${contractAddress}`);
      const regularPoints = new ethers.Contract(contractAddress, RegularPointsABI.abi, signer);
      setRegularPointsContract(regularPoints);
    } else {
      alert("钱包未连接...");
    }
  };

  return (
    <div className="App">
      <h1>基于区块链的积分通兑平台</h1>
      
      {!isWalletConnected ? (
        <div>
          <button onClick={connectWallet}>Connect Wallet</button>
        </div>
      ) : (
        <div>
          {/* 钱包连接后显示的内容 */}
          {account && <p>连接账号: {account}</p>}
          <div>
            <h2>部署普通积分合约</h2>
            <input
              type="text"
              placeholder="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="text"
              placeholder="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
            <button onClick={handleDeploy}>部署通用积分发行合约</button>
          </div>

          <div>
            <h2>导入普通积分合约</h2>
            <input
              type="text"
              placeholder="contract address"
              value={regularPointsAddress}
              onChange={(e) => setRegularPointsAddress(e.target.value)}
            />
            <button onClick={handleLoadContract}>导入合约</button>
          </div>
  
          <div>
            <h2>普通积分发行</h2>
            <input
              type="number"
              value={amountToMint}
              onChange={(e) => setAmountToMint(e.target.value)}
              placeholder="amount"
            />
            <button onClick={issueRegularPoints}>发行积分</button>
          </div>
  
          <div>
            <h2>积分余额</h2>
            <p>通用积分余额: {universalPointsBalance} UPT</p>
            <p>普通积分余额: {userPointsBalance} {symbol || 'RLP'}</p>
            <button onClick={getPointsBalance}>更新余额</button>
          </div>
  
          <div>
            <h2>积分兑换（普通积分兑换成通用积分）</h2>
            <p>Exchange Rate: 1 {symbol || 'RLP'} = {exchangeRate} UPT</p>
            <button onClick={exchangePoints}>兑换</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; // 注意：export 默认导出放在文件最后