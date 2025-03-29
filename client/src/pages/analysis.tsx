import { Link, useLocation } from "wouter";
import { ArrowLeft, BarChart2 } from "lucide-react";
import StatusFooter from "@/components/ui/status-footer";
import React, { useEffect, useState } from "react";

const AnalysisPage = () => {
  const [location, navigate] = useLocation();
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [channelName, setChannelName] = useState<string>("");
  const [channelId, setChannelId] = useState<string>("");
  
  // Retrieve analysis data from localStorage on page load
  useEffect(() => {
    const storedAnalysis = localStorage.getItem("sentimentAnalysisResult");
    const storedChannelName = localStorage.getItem("analysisChannelName");
    const storedChannelId = localStorage.getItem("analysisChannelId");
    
    if (storedAnalysis) {
      setAnalysisResult(storedAnalysis);
    }
    
    if (storedChannelName) {
      setChannelName(storedChannelName);
    }

    if (storedChannelId) {
      setChannelId(storedChannelId);
    }
  }, []);
  
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

  // Function to process sections with headings
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
              {listItems.map((item, i) => (
                <li key={i}>{processBoldText(item)}</li>
              ))}
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
          {listItems.map((item, i) => (
            <li key={i}>{processBoldText(item)}</li>
          ))}
        </ul>
      );
    }
    
    return processedContent;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#36393f] text-[#dcddde]">
      <header className="bg-[#2f3136] p-4 border-b border-gray-700 flex items-center">
        <button
          onClick={(e) => {
            e.preventDefault();
            // Use history.back() to return to the previous view
            window.history.back();
          }}
          className="text-[#72767d] hover:text-[#dcddde] p-1 rounded-full hover:bg-[#36393f]/30 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="ml-3">
          <h1 className="text-lg font-bold text-white flex items-center">
            <BarChart2 className="h-5 w-5 mr-2" />
            Discord Chat Sentiment Analysis
          </h1>
          {channelName && (
            <p className="text-xs text-[#b9bbbe]">
              Channel: {channelName}
            </p>
          )}
        </div>
      </header>
      
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
        <div className="bg-[#2f3136] rounded-lg overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-700">
            <p className="text-xs text-[#b9bbbe]">Analysis powered by OpenAI</p>
          </div>
          
          <div className="p-6">
            {analysisResult ? (
              <div className="prose prose-invert max-w-none">
                {processList(analysisResult)}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-[#72767d]">No analysis results available. Return to the dashboard and run an analysis.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <StatusFooter />
    </div>
  );
};

export default AnalysisPage;
