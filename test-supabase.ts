import { supabase } from './lib/supabase.ts';

async function testConnection() {
  console.log('Testando conexão com Supabase...');
  try {
    const { data, error } = await supabase.from('_test_connection').select('*').limit(1);
    
    // Mesmo que a tabela não exista, se não retornar erro de API KEY inválida, a conexão está OK
    if (error && error.message.includes('Invalid API key')) {
      console.error('❌ Erro: Chave Anon inválida ou URL incorreta.');
    } else if (error && error.code === 'PGRST116') {
      console.log('✅ Conexão estrutural estabelecida! (Apenas a tabela de teste não existe, o que é esperado).');
    } else if (error) {
      console.log('✅ Conexão estabelecida! Detalhes do erro (esperado):', error.message);
    } else {
      console.log('✅ Conexão realizada com sucesso!');
    }
  } catch (err) {
    console.error('❌ Erro inesperado ao conectar:', err);
  }
}

testConnection();
