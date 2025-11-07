import React, { useEffect } from 'react';

const TestComponent = () => {
  useEffect(() => {
    console.log('Import meta:', import.meta);
    console.log('Import meta env:', import.meta.env);
    console.log('VITE_SUPABASE_URL:', import.meta.env?.VITE_SUPABASE_URL);
  }, []);

  return (
    <div>
      <h1>Test Component</h1>
      <p>Check the console for environment variable output</p>
    </div>
  );
};

export default TestComponent;