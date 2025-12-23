'use client'
import React from "react";
import PresentationPage from "./components/PresentationPage";
import { useRouter, useParams } from "next/navigation";

const page = () => {
  const router = useRouter();
  const params = useParams();
  const presentationId = params.id as string;

  if (!presentationId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold">No presentation id found</h1>
        <p className="text-gray-500 pb-4">Please try again</p>
        <button 
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Go to home
        </button>
      </div>
    );
  }
  
  return (
    <PresentationPage presentation_id={presentationId} />
  );
};

export default page;
