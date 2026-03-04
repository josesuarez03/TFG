import React from 'react';

export default function Loading() {
    return (
      <div className="flex justify-center items-center h-screen bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
