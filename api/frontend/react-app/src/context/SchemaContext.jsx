import React, { createContext, useContext, useState } from 'react';

const SchemaContext = createContext({
  schema: 'production',
  isStaging: false,
  setSchema: () => {},
});

export function SchemaProvider({ children }) {
  const [schema, setSchema] = useState('production');
  return (
    <SchemaContext.Provider value={{ schema, isStaging: schema === 'staging', setSchema }}>
      {children}
    </SchemaContext.Provider>
  );
}

export function useSchema() {
  return useContext(SchemaContext);
}
