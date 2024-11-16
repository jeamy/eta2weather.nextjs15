import { LoadingState } from './interface';

export const updateLoadingState = (
  state: { loadingState: LoadingState },
  isLoading: boolean,
  error: string | null = null
) => {
  state.loadingState.isLoading = isLoading;
  state.loadingState.error = error;
};
