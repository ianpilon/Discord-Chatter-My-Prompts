import React from 'react';
import { BarChart2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface AnalysisResultsDialogProps {
  analysisResult: string;
  trigger?: React.ReactNode;
}

export function AnalysisResultsDialog({ analysisResult, trigger }: AnalysisResultsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <button className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded flex items-center gap-1 transition-colors">
            <BarChart2 className="h-3 w-3" />
            View Analysis Results
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-[#36393f] border border-[#40444b] text-white max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="border-b border-[#40444b] pb-3">
          <DialogTitle className="text-[#7289da] flex items-center gap-2 font-semibold">
            <BarChart2 className="h-5 w-5" />
            Discord Chat Sentiment Analysis
          </DialogTitle>
          <p className="text-xs text-[#b9bbbe] mt-1">Analysis powered by OpenAI</p>
        </DialogHeader>
        <div className="mt-4 prose prose-invert max-w-none">
          {analysisResult.split('\n\n').map((section, sectionIndex) => {
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
            
            // Check if this is a header section (starts with ###)
            if (section.startsWith('###')) {
              const headingText = section.replace(/^###\s*/, '');
              return (
                <h2 key={sectionIndex} className="text-xl font-bold text-[#dcddde] mb-3 mt-5 border-b border-[#40444b] pb-2">
                  {processBoldText(headingText)}
                </h2>
              );
            }

            // Handle headings - replace markdown headings with styled headings
            if (section.startsWith('# ')) {
              const headingText = section.replace(/^# /, '');
              return (
                <h2 key={sectionIndex} className="text-xl font-bold text-[#dcddde] mb-3 mt-5 border-b border-[#40444b] pb-2">
                  {processBoldText(headingText)}
                </h2>
              );
            }
            
            // Handle subheadings
            if (section.startsWith('## ')) {
              const subheadingText = section.replace(/^## /, '');
              return (
                <h3 key={sectionIndex} className="text-lg font-semibold text-[#dcddde] mb-2 mt-4">
                  {processBoldText(subheadingText)}
                </h3>
              );
            }
            
            // Handle lists
            if (section.includes('\n- ')) {
              const lines = section.split('\n');
              const listTitle = lines[0];
              const items = lines.slice(1);
              
              return (
                <div key={sectionIndex} className="mb-4">
                  {listTitle && (
                    <p className="text-[#dcddde] mb-2">
                      {processBoldText(listTitle)}
                    </p>
                  )}
                  <ul className="space-y-1">
                    {items.map((item, itemIndex) => (
                      <li key={itemIndex} className="text-[#b9bbbe] ml-5 list-disc">
                        {processBoldText(item.replace(/^- /, ''))}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }
            
            // Regular paragraphs
            return (
              <p key={sectionIndex} className="text-[#dcddde] mb-3">
                {section.split('\n').map((line, lineIndex) => (
                  <React.Fragment key={lineIndex}>
                    {processBoldText(line)}
                    {lineIndex < section.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
