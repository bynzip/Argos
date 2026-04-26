import React, { useState } from 'react';
import { X, UploadCloud } from 'lucide-react';

interface Props {
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
}

export const MultiImageUpload: React.FC<Props> = ({ onFilesChange, maxFiles = 15 }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const totalFiles = [...selectedFiles, ...newFiles].slice(0, maxFiles);
      
      setSelectedFiles(totalFiles);
      onFilesChange(totalFiles);
      
      const newPreviews = totalFiles.map(file => URL.createObjectURL(file));
      setPreviews(newPreviews);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
    onFilesChange(newFiles);
    
    const newPreviews = [...previews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setPreviews(newPreviews);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-center w-full">
        <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <UploadCloud className="w-8 h-8 mb-2 text-gray-500" />
            <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click para subir</span> o arrastra y suelta</p>
            <p className="text-xs text-gray-500">PNG, JPG hasta {maxFiles} fotos</p>
          </div>
          <input id="dropzone-file" type="file" className="hidden" multiple accept="image/*" onChange={handleFileChange} />
        </label>
      </div>
      
      {previews.length > 0 && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <img src={preview} alt={`preview-${index}`} className="h-24 w-full object-cover rounded-md border" />
              <button 
                type="button"
                onClick={() => removeFile(index)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
