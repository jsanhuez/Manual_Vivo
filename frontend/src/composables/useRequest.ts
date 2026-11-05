import { ref, type Ref } from 'vue';
import { ApiError } from '@/api/http';

export function useRequest<T>(loader: () => Promise<T>, immediate = true) {
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(immediate);
  const error = ref<ApiError | null>(null);

  async function run(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      data.value = await loader();
    } catch (caught) {
      error.value = caught instanceof ApiError ? caught : new ApiError(0, ['Ocurrió un error inesperado']);
    } finally {
      loading.value = false;
    }
  }

  if (immediate) {
    void run();
  }
  return { data, loading, error, run };
}
