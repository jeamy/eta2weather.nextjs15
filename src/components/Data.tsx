import { useDataReader } from '@/functions/data';
import { RootState } from '../redux';
import { useSelector } from 'react-redux';
import { useEffect } from 'react';

const DataInput: React.FC = () => {
    const { loadData } = useDataReader("data.json");
    const data = useSelector((state: RootState) => state.data);

    useEffect(() => {
        loadData();
    }, [loadData]);

    return (
        <div>
            <h1>Data:</h1>
            <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
    );
}

export default DataInput;
