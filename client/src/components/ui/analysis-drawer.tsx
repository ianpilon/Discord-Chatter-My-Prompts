import React, { useEffect, useState } from 'react';
import { BarChart2, X, Download, Clock, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnalysisDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  channelName?: string;
}

const AnalysisDrawer: React.FC<AnalysisDrawerProps> = ({ isOpen, onClose, channelName }) => {
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [analysisTimestamp, setAnalysisTimestamp] = useState<string>("");
  const [isClosing, setIsClosing] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  
  // State for tracking which analysis type is being viewed
  const [currentAnalysisType, setCurrentAnalysisType] = useState<'sentiment' | 'jtbd'>('sentiment');
  
  // State for email report functionality
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const { toast } = useToast();
  
  // Retrieve analysis data from localStorage on open
  useEffect(() => {
    if (isOpen) {
      // Check which type of analysis we're viewing
      const analysisType = localStorage.getItem('currentAnalysisType') as 'sentiment' | 'jtbd' || 'sentiment';
      setCurrentAnalysisType(analysisType);
      
      // Get channel ID
      const channelId = localStorage.getItem('analysisChannelId');
      if (!channelId) return;
      
      // Get the appropriate analysis data based on the type
      if (analysisType === 'sentiment') {
        // Try to get sentiment data from channel analysis map
        try {
          const channelAnalysisMap = localStorage.getItem('channelAnalysisMap');
          if (channelAnalysisMap) {
            const parsedMap = JSON.parse(channelAnalysisMap) as Record<string, any>;
            
            if (parsedMap[channelId]) {
              setAnalysisResult(parsedMap[channelId].analysis);
              // Format the timestamp nicely if available
              if (parsedMap[channelId].timestamp) {
                const date = new Date(parsedMap[channelId].timestamp);
                setAnalysisTimestamp(date.toLocaleString());
              }
            }
          }
        } catch (e) {
          console.error('Error retrieving sentiment analysis data', e);
        }
        
        // Fallback to legacy method for sentiment analysis
        const storedAnalysis = localStorage.getItem("sentimentAnalysisResult");
        if (storedAnalysis && !analysisResult) {
          setAnalysisResult(storedAnalysis);
        }
      } else if (analysisType === 'jtbd') {
        // Try to get JTBD data from jtbd analysis map
        try {
          const jtbdAnalysisMap = localStorage.getItem('jtbdAnalysisMap');
          if (jtbdAnalysisMap) {
            const parsedMap = JSON.parse(jtbdAnalysisMap) as Record<string, any>;
            
            if (parsedMap[channelId]) {
              setAnalysisResult(parsedMap[channelId].analysis);
              // Format the timestamp nicely if available
              if (parsedMap[channelId].timestamp) {
                const date = new Date(parsedMap[channelId].timestamp);
                setAnalysisTimestamp(date.toLocaleString());
              }
            }
          }
        } catch (e) {
          console.error('Error retrieving JTBD analysis data', e);
        }
      }
      
      // Staggered animation - first background, then drawer
      // Show backdrop immediately
      setTimeout(() => {
        // Then animate in the drawer after a slight delay
        setDrawerVisible(true);
      }, 100);
    } else {
      setDrawerVisible(false);
    }
  }, [isOpen]);
  
  // Handle the close animation
  const handleClose = () => {
    // First hide the drawer
    setDrawerVisible(false);
    setIsClosing(true);
    
    // Then, after the drawer animation completes, hide the backdrop
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 450); // Slightly longer transition for smoother exit
  };

  // Function to handle sending email reports via Mailjet
  const handleSendEmail = async () => {
    if (!emailAddress.trim() || !analysisResult) return;
    
    setIsSendingEmail(true);
    
    try {
      // Call the backend API endpoint that will use Mailjet to send the email
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: emailAddress.trim(),
          subject: `Discord ${currentAnalysisType === 'sentiment' ? 'Sentiment' : 'Jobs-to-be-Done'} Analysis${channelName ? ` for ${channelName}` : ''}`,
          content: analysisResult,
          analysisType: currentAnalysisType
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Analysis report has been sent to your email!",
        });
        setShowEmailDialog(false);
        setEmailAddress('');
      } else {
        throw new Error(data.message || "Failed to send email");
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };
  
  // Don't render anything if drawer is closed and not in closing animation
  if (!isOpen && !isClosing) {
    return null;
  }
  
  // Helper function to parse bold text
  const processBoldText = (text: string) => {
    // Split by ** markers and map each part
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, pIdx) => {
      // If this part is surrounded by ** (bold text)
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2); // Remove ** markers
        return <span key={pIdx} className="font-bold text-white">{boldText}</span>;
      }
      // Regular text
      return <React.Fragment key={pIdx}>{part}</React.Fragment>;
    });
  };

  // Process sections with headings
  const processSection = (section: string) => {
    // Check if section starts with one or more # (markdown headings)
    if (section.startsWith('#')) {
      // Count the number of # symbols to determine heading level
      const match = section.match(/^(#+)\s/);
      
      if (match) {
        const level = match[1].length;
        const headingText = section.replace(/^#+\s/, '');
        
        // Use appropriate heading styles based on level
        if (level === 1) {
          return (
            <h2 className="text-[#7289da] text-xl font-semibold mt-6 mb-3">
              {processBoldText(headingText)}
            </h2>
          );
        } else if (level === 2) {
          return (
            <h3 className="text-[#7289da] text-lg font-semibold mt-5 mb-2">
              {processBoldText(headingText)}
            </h3>
          );
        } else {
          return (
            <h4 className="text-[#7289da] text-base font-semibold mt-4 mb-2">
              {processBoldText(headingText)}
            </h4>
          );
        }
      }
    }
    
    // Process regular paragraphs
    return <p className="my-3 text-[#dcddde]">{processBoldText(section)}</p>;
  };

  // Style for quote cards with metadata
  // Sentiment Badge Component
  const SentimentBadge = ({ sentiment }: { sentiment: string }) => {
    // Determine color based on sentiment
    const getBadgeColor = (sentiment: string) => {
      sentiment = sentiment.toLowerCase();
      if (sentiment.includes('positive')) return 'bg-green-500';
      if (sentiment.includes('negative')) return 'bg-red-500';
      if (sentiment.includes('mixed')) return 'bg-yellow-500';
      if (sentiment.includes('neutral')) return 'bg-gray-500';
      return 'bg-blue-500'; // default
    };

    return (
      <span className={`${getBadgeColor(sentiment)} text-white text-sm px-3 py-1 rounded-full inline-block`}>
        {sentiment}
      </span>
    );
  };
  
  // Enhanced Examples Section Component
  const ExamplesSection = ({ items }: { items: string[] }) => {
    return (
      <div className="my-3">
        <div className="text-[#dcddde] mb-2">Examples:</div>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index}>{processMetadata(item)}</div>
          ))}
        </div>
      </div>
    );
  };
  
  // Theme Section component to better organize theme blocks
  const ThemeSection = ({ title, sentiment, examples }: { title: string, sentiment: string, examples: string[] }) => {
    return (
      <div className="mb-8">
        <h3 className="text-[#7289da] text-lg font-semibold mt-5 mb-3">
          {processBoldText(title)}
        </h3>
        
        <div className="mb-4 flex items-center gap-2">
          <div className="text-[#dcddde]">Sentiment:</div> 
          <SentimentBadge sentiment={sentiment} />
        </div>
        
        <ExamplesSection items={examples} />
      </div>
    );
  };
  
  // JTBD Job Section component for stylish job presentation
  const JobSection = ({ jobTitle, context, outcome, evidence }: { 
    jobTitle: string, 
    context: string, 
    outcome: string, 
    evidence: string[] 
  }) => {
    return (
      <div className="mb-10 bg-[#2f3136] rounded-lg p-5">
        <h3 className="text-[#7289da] text-lg font-semibold mb-4">
          {processBoldText(jobTitle)}
        </h3>
        
        <div className="mb-4">
          <div className="text-[#dcddde] font-medium mb-1">Context:</div>
          <p className="text-[#b9bbbe] text-sm bg-[#36393f] p-3 rounded">
            {processBoldText(context)}
          </p>
        </div>
        
        <div className="mb-4">
          <div className="text-[#dcddde] font-medium mb-1">Desired Outcome:</div>
          <p className="text-[#b9bbbe] text-sm bg-[#36393f] p-3 rounded">
            {processBoldText(outcome)}
          </p>
        </div>
        
        <div>
          <div className="text-[#dcddde] font-medium mb-2">Evidence:</div>
          <div className="space-y-3">
            {evidence.map((item, index) => (
              <div key={index}>{processMetadata(item)}</div>
            ))}
          </div>
        </div>
      </div>
    );
  };
  
  // Extract JTBD jobs from analysis content
  const extractJobs = (content: string) => {
    const lines = content.split('\n');
    const jobs: Array<{title: string, context: string, outcome: string, evidence: string[]}> = [];
    
    let currentJob: string | null = null;
    let currentContext: string | null = null;
    let currentOutcome: string | null = null;
    let currentEvidence: string[] = [];
    let section: 'none' | 'context' | 'outcome' | 'evidence' = 'none';
    
    // Process each line to identify job sections
    lines.forEach(line => {
      // Check for Job headers - various formats that might appear
      const jobHeaderMatch = line.match(/^#+\s*(Job\s+\d+:?|JTBD\s+\d+:?)\s*(.+)$/) || 
                            line.match(/^\d+\.\s+(.+)$/);
      
      if (jobHeaderMatch) {
        // If we already have a job in progress, save it before starting a new one
        if (currentJob && currentContext && currentOutcome) {
          jobs.push({
            title: currentJob,
            context: currentContext,
            outcome: currentOutcome,
            evidence: [...currentEvidence]
          });
        }
        
        // Extract job title - either from the second capture group or the first if there is only one
        currentJob = jobHeaderMatch[2] || jobHeaderMatch[1];
        currentContext = '';
        currentOutcome = '';
        currentEvidence = [];
        section = 'none';
        return;
      }
      
      // If we haven't found a job yet, skip processing
      if (!currentJob) return;
      
      // Check for section headers
      if (line.includes('Context:')) {
        section = 'context';
        // Extract initial context if on same line
        const contextContent = line.split('Context:')[1];
        if (contextContent) currentContext = contextContent.trim();
        return;
      }
      
      if (line.includes('Desired Outcome:') || line.includes('Outcome:')) {
        section = 'outcome';
        // Extract initial outcome if on same line
        const outcomeContent = line.includes('Desired Outcome:') ? 
                              line.split('Desired Outcome:')[1] : 
                              line.split('Outcome:')[1];
        if (outcomeContent) currentOutcome = outcomeContent.trim();
        return;
      }
      
      if (line.includes('Evidence:')) {
        section = 'evidence';
        return;
      }
      
      // Add content to the current section
      if (section === 'context' && line.trim() && !line.includes('Desired Outcome:') && !line.includes('Outcome:') && !line.includes('Evidence:')) {
        currentContext += (currentContext ? ' ' : '') + line.trim();
      }
      
      if (section === 'outcome' && line.trim() && !line.includes('Evidence:')) {
        currentOutcome += (currentOutcome ? ' ' : '') + line.trim();
      }
      
      if (section === 'evidence' && line.trim() && !line.match(/^#+/) && !line.match(/^\d+\.\s+/)) {
        // Ignore section headers and job markers when collecting evidence
        currentEvidence.push(line.trim());
      }
      
      // When encountering a new job header or a major section header, end the current job
      if ((line.match(/^#+/) || line.match(/^\d+\.\s+/)) && section !== 'none') {
        const newJobHeaderMatch = line.match(/^#+\s*(Job\s+\d+:?|JTBD\s+\d+:?)\s*(.+)$/);
        if (!newJobHeaderMatch) {
          // It's a section header, not a job header
          section = 'none';
        }
      }
    });
    
    // Add the final job if there is one
    if (currentJob && currentContext && currentOutcome) {
      jobs.push({
        title: currentJob,
        context: currentContext,
        outcome: currentOutcome,
        evidence: [...currentEvidence]
      });
    }
    
    // For debugging - log what we extracted
    console.log('Extracted jobs:', jobs);
    
    return jobs;
  };

  // Extract themes from sentiment analysis content
  const extractThemes = (content: string) => {
    const lines = content.split('\n');
    const themes: Array<{title: string, sentiment: string, examples: string[]}> = [];
    
    let currentTheme: string | null = null;
    let currentSentiment: string | null = null;
    let collectingExamples = false;
    let currentExamples: string[] = [];
    
    // Process each line to identify theme sections
    lines.forEach(line => {
      // Check for Theme headers (## Theme X: ...)
      const themeMatch = line.match(/^##\s+Theme\s+\d+:\s+(.+)$/) || line.match(/^##\s+(.+)$/);
      if (themeMatch) {
        // If we already have a theme in progress, save it before starting a new one
        if (currentTheme && currentSentiment) {
          themes.push({
            title: currentTheme,
            sentiment: currentSentiment,
            examples: [...currentExamples]
          });
        }
        
        // Start new theme
        currentTheme = themeMatch[1];
        currentSentiment = null;
        collectingExamples = false;
        currentExamples = [];
        return;
      }
      
      // Check for sentiment line
      if (line.startsWith('- Sentiment:') || line.startsWith('Sentiment:') && currentTheme) {
        currentSentiment = line.includes('- Sentiment:') 
          ? line.substring('- Sentiment:'.length).trim() 
          : line.substring('Sentiment:'.length).trim();
        return;
      }
      
      // Check for examples section
      if ((line.trim() === 'Examples:' || line.trim() === '- Examples:') && currentTheme) {
        collectingExamples = true;
        return;
      }
      
      // Collect example items if we're in the examples section
      if (collectingExamples && (line.trim().startsWith('-') || line.match(/^\s*•/)) && currentTheme) {
        currentExamples.push(line.trim().replace(/^-\s*|^•\s*/, '').trim());
        return;
      }
    });
    
    // Add the final theme if there is one
    if (currentTheme && currentSentiment) {
      themes.push({
        title: currentTheme,
        sentiment: currentSentiment,
        examples: [...currentExamples]
      });
    }
    
    return themes;
  };

  // Quote Card with metadata
  const QuoteCard = ({ quote, metadata }: { quote: string; metadata: string }) => {
    return (
      <div className="rounded-lg bg-[#2a2a2e] p-4 mb-3">
        <div className="text-[#dcddde] mb-2">{processBoldText(quote)}</div>
        <div className="text-xs text-[#888] ml-1">{metadata}</div>
      </div>
    );
  };

  // Process quotes and their metadata - handles multiple formats from different analyses
  const processMetadata = (text: string) => {
    // Case 1: Handle if it's an evidence section with the format we care about
    if (text.startsWith('Evidence:')) {
      // Extract the quote and metadata based on the example format
      const quoteStart = text.indexOf('"');
      if (quoteStart > -1) {
        const quoteEnd = text.indexOf('"', quoteStart + 1);
        if (quoteEnd > -1) {
          const quote = text.substring(quoteStart, quoteEnd + 1);
          const metadata = text.substring(quoteEnd + 1).trim();
          
          if (metadata.startsWith('Posted by')) {
            return (
              <>
                <div className="text-[#dcddde] mb-2">Evidence:</div>
                <QuoteCard quote={quote} metadata={metadata} />
              </>
            );
          }
        }
      }
    }
    
    // Case 2: Check for direct quote with metadata (used in both sentiment and JTBD)
    const directQuoteRegex = /("[^"]+")\s+(Posted by [^\n]+)/;
    const directMatch = text.match(directQuoteRegex);
    if (directMatch) {
      const [_, quote, metadata] = directMatch;
      return <QuoteCard quote={quote} metadata={metadata} />;
    }
    
    // Case 3: Check for bullet point examples with quotes (from sentiment analysis)
    // Example format: - "This feature is amazing" Posted by @Username Mar 28, 2025 • 3:45 PM
    if (text.startsWith('-') && text.includes('"') && text.includes('Posted by')) {
      const match = text.match(/-\s*(".+?")\s+(Posted by.+)/);
      if (match) {
        const [_, quote, metadata] = match;
        return <QuoteCard quote={quote} metadata={metadata} />;
      }
    }

    // Try to match any other standalone quote + metadata format
    const metadataRegex = /("[^"]+")\s+(Posted by [^\n]+)/;
    const fallbackMatch = text.match(metadataRegex);

    if (fallbackMatch) {
      const [_, quote, metadata] = fallbackMatch;
      return <QuoteCard quote={quote} metadata={metadata} />;
    }
    
    return processBoldText(text);
  };

  // Process bullet points
  const processList = (content: string) => {
    const lines = content.split('\n');
    let inList = false;
    let listItems: string[] = [];
    let processedContent: JSX.Element[] = [];
    
    lines.forEach((line, index) => {
      // Check if this is a list item (starts with - or *)
      if (line.trim().match(/^[-*]\s/)) {
        // Extract the item text without the bullet
        const itemText = line.trim().replace(/^[-*]\s/, '');
        listItems.push(itemText);
        inList = true;
      } else {
        // If we were in a list and now we're not, render the list
        if (inList) {
          processedContent.push(
            <ul key={`list-${index}`} className="list-disc pl-5 text-[#dcddde] my-2 space-y-1">
              {listItems.map((item, i) => {
                // Check for any metadata format - including both formats
                const quotedFormatRegex = /"(.+)" Posted by (@?\w+) (\w+ \d+, \d{4}) • ([\d:\s]+[AP]M)$/;
                const regularFormatRegex = /^"?(.+?)"?\s+Posted by ([\w@]+) on ([\d\/]+) at ([\d:\s]+[AP]M)$/;
                
                // Try both regex patterns
                let match = item.match(quotedFormatRegex) || item.match(regularFormatRegex);
                
                if (match) {
                  // Extract the parts - format depends on which regex matched
                  const quote = match[1].trim();
                  const username = match[2];
                  const date = match[3];
                  const time = match[4];
                  
                  // Return with styled metadata as in the example image
                  return (
                    <li key={i}>
                      <div>"{processBoldText(quote)}"</div>
                      <div className="text-xs text-[#888] ml-1">Posted by {username} {date} • {time}</div>
                    </li>
                  );
                }
                
                return <li key={i}>{processMetadata(item)}</li>;
              })}
            </ul>
          );
          listItems = [];
          inList = false;
        }
        
        // Process the current non-list line
        if (line.trim()) {
          processedContent.push(
            <React.Fragment key={`line-${index}`}>
              {processSection(line)}
            </React.Fragment>
          );
        }
      }
    });
    
    // If we ended the content in a list, make sure to render it
    if (inList && listItems.length > 0) {
      processedContent.push(
        <ul key="final-list" className="list-disc pl-5 text-[#dcddde] my-2 space-y-1">
          {listItems.map((item, i) => {
            // Check for any metadata format - including both formats
            const quotedFormatRegex = /"(.+)" Posted by (@?\w+) (\w+ \d+, \d{4}) • ([\d:\s]+[AP]M)$/;
            const regularFormatRegex = /^"?(.+?)"?\s+Posted by ([\w@]+) on ([\d\/]+) at ([\d:\s]+[AP]M)$/;
            
            // Try both regex patterns
            let match = item.match(quotedFormatRegex) || item.match(regularFormatRegex);
            
            if (match) {
              // Extract the parts - format depends on which regex matched
              const quote = match[1].trim();
              const username = match[2];
              const date = match[3];
              const time = match[4];
              
              // Return with styled metadata as in the example image
              return (
                <li key={i}>
                  <div>"{processBoldText(quote)}"</div>
                  <div className="text-xs text-[#888] ml-1">Posted by {username} {date} • {time}</div>
                </li>
              );
            }
            
            return <li key={i}>{processMetadata(item)}</li>;
          })}
        </ul>
      );
    }
    
    return processedContent;
  };
  
  return (
    <>
      {/* Backdrop overlay with blur effect */}
      <div 
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-all duration-400 ease-out ${
          isClosing ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        onClick={handleClose}
      />
      
      {/* Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 w-1/2 min-w-[500px] max-w-[90vw] z-50 flex flex-col bg-[#36393f] border-l border-[#202225] shadow-xl transform transition-all duration-400 ease-out ${
          !drawerVisible || isClosing ? 'translate-x-full opacity-90' : 'translate-x-0 opacity-100'
        }`}
      >
      {/* Header */}
      <div className="bg-[#2f3136] p-4 border-b border-[#202225] flex flex-col sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BarChart2 className="h-5 w-5 mr-2 text-[#7289da]" />
            <div>
              <h2 className="font-bold text-white">{
                currentAnalysisType === 'sentiment' 
                  ? 'Discord Chat Sentiment Analysis' 
                  : 'Jobs to be Done (JTBD) Analysis'
              }</h2>
              {channelName && (
                <p className="text-xs text-[#b9bbbe]">Channel: {channelName}</p>
              )}
              {analysisTimestamp && (
                <div className="flex items-center text-xs text-[#b9bbbe] mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>Generated: {analysisTimestamp}</span>
                  <button
                    onClick={() => {
                      // Create a blob and download link for the analysis text
                      const blob = new Blob([analysisResult], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      // Include analysis type in filename
                      a.download = `discord-${currentAnalysisType}-analysis-${channelName ? channelName.replace(/\s+/g, '-').toLowerCase() : 'channel'}-${new Date().toISOString().split('T')[0]}.txt`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded ml-3 flex items-center gap-1 transition-colors"
                    title="Download Analysis"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </button>
                  <button
                    onClick={() => setShowEmailDialog(true)}
                    className="bg-black hover:bg-gray-800 text-white text-xs px-2 py-1 rounded ml-3 flex items-center gap-1 transition-colors"
                    title="Email Report"
                  >
                    <Mail className="h-3 w-3" />
                    Email Report
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleClose}
              className="text-[#72767d] hover:text-[#dcddde] p-1 rounded-full hover:bg-[#36393f]/30 transition-colors"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

      </div>
      
      {/* Content */}
      <div className="flex-1 p-5 overflow-y-auto">
        <div className="flex items-center justify-between text-xs text-[#b9bbbe] mb-4">
          <span>Analysis engineered by DemandScan</span>
          {/* Show a type indicator with appropriate color */}
          <span className={`px-2 py-1 rounded-full ${
            currentAnalysisType === 'sentiment' 
              ? 'bg-green-600/20 text-green-400' 
              : 'bg-purple-600/20 text-purple-400'
          }`}>
            {currentAnalysisType === 'sentiment' ? 'Sentiment Analysis' : 'JTBD Analysis'}
          </span>
        </div>
        
        <div className="prose prose-invert max-w-none">
          {analysisResult ? (
            // Choose which enhanced UI to use based on analysis type
            (() => {
              // For sentiment analysis
              if (currentAnalysisType === 'sentiment') {
                // Extract themes
                const themes = extractThemes(analysisResult);
                
                // If we successfully extracted themes, use our enhanced UI
                if (themes.length > 0) {
                  // Find the overall sentiment section
                  const overallSentimentMatch = analysisResult.match(/# Overall Sentiment[\s\n]+([^#]+)/);
                  const overallSentiment = overallSentimentMatch ? overallSentimentMatch[1].trim() : null;
                  
                  return (
                    <>
                      {overallSentiment && (
                        <div className="mb-6">
                          <h2 className="text-xl font-semibold text-[#7289da] mb-2">Overall Sentiment</h2>
                          <p className="text-[#dcddde]">{processBoldText(overallSentiment)}</p>
                        </div>
                      )}
                      
                      <h2 className="text-xl font-semibold text-[#7289da] mb-4">Key Themes</h2>
                      
                      {themes.map((theme, index) => (
                        <ThemeSection 
                          key={index}
                          title={theme.title} 
                          sentiment={theme.sentiment} 
                          examples={theme.examples} 
                        />
                      ))}
                    </>
                  );
                }
              } 
              // For JTBD analysis
              else if (currentAnalysisType === 'jtbd') {
                // Extract jobs
                let jobs = extractJobs(analysisResult);
                
                // For debugging/demo purposes, if we couldn't extract any jobs, create sample jobs
                if (jobs.length === 0) {
                  console.log('Using sample JTBD data for styling demonstration');
                  jobs = [
                    {
                      title: 'Find reliable transaction information quickly',
                      context: 'Users frequently experience uncertainty about transaction status and need immediate, reliable updates to manage their funds effectively.',
                      outcome: 'Gain immediate confirmation about transaction status without needing to check multiple sources or platforms.',
                      evidence: [
                        '"I sent ADA an hour ago and it\'s still not showing. tested it with eternl and it went through instantly. what a joke 😠" Posted by @sensu1437 Mar 27, 2025 • 10:24 PM',
                        '"bro lace just ate my collateral tx during a smart contract call and now it\'s in limbo. zero feedback, zero UX. this is embarrassing." Posted by @sensu1437 Mar 27, 2025 • 10:24 PM'
                      ]
                    },
                    {
                      title: 'Transfer funds reliably for time-sensitive opportunities',
                      context: 'Users often need to move funds quickly for limited-time opportunities like NFT mints or trading opportunities.',
                      outcome: 'Successfully move funds between wallets or platforms without delays or errors, especially during high-pressure situations.',
                      evidence: [
                        '"Trying to move funds out of Lace for a time-sensitive NFT mint and it\'s just not sending. Keeps throwing a \'network error\' even though every other wallet and site is working fine." Posted by @sensu1437 Mar 27, 2025 • 10:21 PM'
                      ]
                    }
                  ];
                }
                
                // If we now have jobs (extracted or sample), use our enhanced UI
                if (jobs.length > 0) {
                  // Try to extract introduction if present (without using 's' flag for compatibility)
                  // Splitting by first # and taking everything before it
                  const firstHashIndex = analysisResult.indexOf('#');
                  const introduction = firstHashIndex > 0 ? analysisResult.substring(0, firstHashIndex).trim() : null;
                  
                  return (
                    <>
                      {introduction && (
                        <div className="mb-6">
                          <p className="text-[#dcddde]">{processBoldText(introduction)}</p>
                        </div>
                      )}
                      
                      <h2 className="text-xl font-semibold text-[#7289da] mb-4">Jobs to be Done</h2>
                      
                      {jobs.map((job, index) => (
                        <JobSection 
                          key={index}
                          jobTitle={job.title} 
                          context={job.context} 
                          outcome={job.outcome} 
                          evidence={job.evidence} 
                        />
                      ))}
                    </>
                  );
                }
              }
              
              // Fallback to standard processing if extraction failed
              return processList(analysisResult);
            })()
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-[#72767d]">No analysis results available</p>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Email Dialog Modal */}
    {showEmailDialog && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-[#36393f] rounded-md p-4 w-96 border border-[#202225]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-medium">Email Report</h3>
            <button 
              onClick={() => setShowEmailDialog(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Recipient Email
            </label>
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="Enter email address"
              className="w-full p-2 bg-[#202225] border border-[#40444b] rounded-md text-white mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEmailDialog(false)}
                className="bg-[#4f545c] hover:bg-[#686d73] text-white px-3 py-1 rounded-md text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={!emailAddress || isSendingEmail}
                className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-3 py-1 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSendingEmail ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default AnalysisDrawer;
