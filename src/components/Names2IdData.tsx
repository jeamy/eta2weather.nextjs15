import React, { useEffect } from 'react';
import { useLoadNames2Id } from '../functions/Names2Id';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';

const Names2IdData: React.FC = () => {
  const config = useSelector((state: RootState) => state.config);
  const loadNames2Id = useLoadNames2Id(config);

  useEffect(() => {
    loadNames2Id();
  }, [loadNames2Id]);

  return (
    <div>
        <h1>Names2Id:</h1>
        <pre>{JSON.stringify(loadNames2Id, null, 2)}</pre>
    </div>
);

};

export default Names2IdData


