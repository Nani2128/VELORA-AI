import React, { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { CreatePage } from './CreatePage';

export const ImageGeneratorPage: React.FC = () => {
  const { setGenerationType } = useAppStore();

  useEffect(() => {
    setGenerationType('TEXT_TO_IMAGE');
  }, [setGenerationType]);

  return <CreatePage />;
};
