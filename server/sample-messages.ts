import { Message } from 'discord.js';

// Create realistic mock messages from different users that will appear in the UI
export function generateSampleMessages(channelId: string): Message[] {
  const usernames = [
    'CardanoFan', 'LaceUser42', 'ADAHodler', 'CryptoWizard', 'StakingPro',
    'WalletEnthusiast', 'BlockchainDev', 'CardanoAlice', 'DeFiDesigner', 'StakepoolJosh',
    'SmartContractDev', 'Cardano_Sam', 'DAppEngineer', 'StakingQueen', 'TokenCreator',
    'NFTArtist', 'CryptoInvestor', 'SecurityExpert', 'MobileWalletUser', 'DeFiExplorer'
  ];
  
  const avatarColors = ['red', 'blue', 'green', 'purple', 'orange', 'teal', 'pink', 'yellow', 'indigo', 'brown'];
  
  const laceWalletTopics = [
    'Just updated to the latest version of Lace wallet! The UI improvements are fantastic.',
    'Has anyone tried the new DApp connector? I\'m having trouble connecting to SundaeSwap.',
    'Looking for feedback on my NFT collection - just minted them through Lace!',
    'Need recommendations for the best Cardano stake pools with consistent returns.',
    'Our team is developing a new DeFi protocol for Cardano. Looking for beta testers soon!',
    'What\'s your preferred Cardano wallet? Been using Eternl but thinking about switching fully to Lace.',
    'Finally fixed that annoying transaction issue that was driving me crazy!',
    'Anyone attending Cardano Summit this year? Would love to connect with some of you in person.',
    'Just launched our DApp on mainnet - huge thanks to this community for all the feedback during development!',
    'Having trouble with delegate portfolio feature. Any suggestions?',
    'What\'s your approach to diversifying your ADA staking across multiple pools?',
    'Just set up hardware wallet support with Lace - surprisingly easier than expected.',
    'Any recommendations for good Cardano blockchain explorers that show detailed transaction data?',
    'Working on a guide for Lace wallet features, will share the link when it\'s published.',
    'Does anyone have experience with Plutus for smart contracts? How long does development typically take?',
    'Need advice on optimizing transaction fees - currently having issues with complex scripts.',
    'What analytics platforms are you using to track your Cardano portfolio performance?',
    'Anyone interested in testing our new DeFi yield farming protocol next weekend?',
    'How do you organize your different tokens and NFTs in Lace?',
    'Just discovered a great feature in Lace wallet. The multi-address support is incredibly useful! 😊'
  ];
  
  // Create about 20 mock messages with different users and timestamps
  const mockMessages = [];
  
  // Current timestamp to base message times on
  const currentTime = new Date();
  
  for (let i = 0; i < 20; i++) {
    const randomUsername = usernames[i % usernames.length];
    const randomColor = avatarColors[i % avatarColors.length];
    const randomTopic = laceWalletTopics[i % laceWalletTopics.length];
    
    // Create messages with decreasing timestamps (newer messages at the top)
    const messageTime = new Date(currentTime);
    messageTime.setMinutes(messageTime.getMinutes() - (i * 15)); // 15 minute intervals
    
    // Generate a consistent avatar URL based on the username for randomavatar.com
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomUsername}`;
    
    mockMessages.push({
      id: `100000000000000${(2000 + i).toString()}`,
      channelId: channelId,
      author: { 
        id: `user${(1000 + i).toString()}`, 
        username: randomUsername,
        // Add avatar URL to author object for display
        avatarURL: avatarUrl,
        discriminator: (1000 + i).toString().substring(0, 4)
      },
      content: randomTopic,
      createdAt: messageTime,
    } as unknown as Message);
  }
  
  return mockMessages;
}
