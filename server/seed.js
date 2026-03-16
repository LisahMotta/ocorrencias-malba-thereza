// seed.js — cria os usuários iniciais no banco com senha padrão
// Execute com: npm run seed
const bcrypt = require('bcryptjs');
const db = require('./db');

const SENHA_PADRAO = 'Malba@2025';

const USUARIOS = [
  { nome: 'SANDRA REGINA XAVIER DA SILVA',                   perfil: 'diretor'      },
  { nome: 'BRUNO PACHECO DOS SANTOS',                        perfil: 'vice'         },
  { nome: 'THAÍS JOSÉ SOARES',                               perfil: 'vice'         },
  { nome: 'MARIA CRISTINA DA SILVA',                         perfil: 'vice'         },
  { nome: 'ARIADNE DA SILVA RODRIGUES',                      perfil: 'coordenador'  },
  { nome: 'WAGNER GONÇALVES DA SILVA JUNIOR FERRO FAZAN',    perfil: 'coordenador'  },
  { nome: 'RENATA VALÉRIA',                                  perfil: 'coordenador'  },
  { nome: 'ADRIANA PEREIRA DOS SANTOS',                      perfil: 'professor'    },
  { nome: 'ANA CLAUDIA PINHEIRO DA SILVA CRUZ',              perfil: 'professor'    },
  { nome: 'ARINE IWAMOTO SANCHES FAGUNDES',                  perfil: 'professor'    },
  { nome: 'CAMILO DE LELIS AMARAL',                          perfil: 'professor'    },
  { nome: 'CRISTIANE SERPA QUILICI',                         perfil: 'professor'    },
  { nome: 'CRISTINA MARIA MARTINS LANDIM RIBEIRO',           perfil: 'professor'    },
  { nome: 'DALVA MARIA SILVÉRIO',                            perfil: 'professor'    },
  { nome: 'DANIEL CÉSAR DE OLIVEIRA',                        perfil: 'professor'    },
  { nome: 'DIANA RIBEIRO ANDRADE LIMA',                      perfil: 'professor'    },
  { nome: 'EDMILSON APARECIDO DE SOUSA',                     perfil: 'professor'    },
  { nome: 'ERICA DE PAULA APARECIDA CABERLIM',               perfil: 'professor'    },
  { nome: 'ERICK RODRIGUES DE CARVALHO',                     perfil: 'professor'    },
  { nome: 'EUNICE APARECIDA DE FARIA QUADROS',               perfil: 'professor'    },
  { nome: 'GABRIEL GUIDO DE ALMEIDA',                        perfil: 'professor'    },
  { nome: 'GIOVANNA PONTES SANTOS',                          perfil: 'professor'    },
  { nome: 'IVANILDA DE JESUS PAIVA',                         perfil: 'professor'    },
  { nome: 'JESSICA KAREN DOS SANTOS SOLEO',                  perfil: 'professor'    },
  { nome: 'JOÃO FLAVIO FRAGA',                               perfil: 'professor'    },
  { nome: 'JUSCELENE SUMARA LESSA LANCELOTTI DI LUCCIO',     perfil: 'professor'    },
  { nome: 'KARINA DE SOUZA RIBEIRO',                         perfil: 'professor'    },
  { nome: 'KARINA KOIBUCHI SAKANE',                          perfil: 'professor'    },
  { nome: 'LAURENTINA ELIAS DUARTE',                         perfil: 'professor'    },
  { nome: 'LEACIRA FREITAS DE ANDRADES SIMAN',               perfil: 'professor'    },
  { nome: 'LUANA CRISTINA FERREIRA DE OLIVEIRA',             perfil: 'professor'    },
  { nome: 'MAGALI RAMOS FERREIRA',                           perfil: 'professor'    },
  { nome: 'MARIA CRISTINA DE ALMEIDA PORTO SILVA',           perfil: 'professor'    },
  { nome: 'MARIA DE FÁTIMA DIAS',                            perfil: 'professor'    },
  { nome: 'MAYARA SELMA PURCINO MACEDO',                     perfil: 'professor'    },
  { nome: 'MEIRE APARECIDA GAEFKE',                          perfil: 'professor'    },
  { nome: 'NILCELENA SOUZA PORTILHO',                        perfil: 'professor'    },
  { nome: 'PAULO CESAR ROCHA GOMES',                         perfil: 'professor'    },
  { nome: 'RENATA APARECIDA MOYSES DE FREITAS',              perfil: 'professor'    },
  { nome: 'ROSEANE MOREIRA DA SILVA SALES',                  perfil: 'professor'    },
  { nome: 'SAMANTHA MARINA RIBEIRO MARTINS LEITE',           perfil: 'professor'    },
  { nome: 'SILVANA MÁRCIA DE SOUZA',                         perfil: 'professor'    },
  { nome: 'SILVIA FERREIRA LOPES DE OLIVEIRA',               perfil: 'professor'    },
  { nome: 'SIOMARA VILELA PRADO FONSECA',                    perfil: 'professor'    },
  { nome: 'SOLANGE SANTOS ARAÚJO',                           perfil: 'professor'    },
  { nome: 'SONIA MARIA DA SILVA GABRIEL',                    perfil: 'professor'    },
  { nome: 'THIAGO JOSÉ DIOGO ALVES OLIVEIRA',                perfil: 'professor'    },
  { nome: 'VICENTE CESAR DA SILVA',                          perfil: 'professor'    },
  { nome: 'VIVIANE SANTOS DE OLIVEIRA',                      perfil: 'professor'    },
  { nome: 'WALDINEIA CRISTINA RODRIGUES DOS SANTOS',         perfil: 'professor'    },
  { nome: 'WELLINGTON ROBERTO GALVAO BORGES DE OLIVEIRA',    perfil: 'professor'    },
  // Agentes de Organização Escolar
  { nome: 'KÁTIA MARA FERREIRA DIAS MARTINS',                perfil: 'professor'    },
  { nome: 'ALINE BAUMGARTER',                                perfil: 'professor'    },
  { nome: 'ELISABETH APARECIDA BERNARDES DE FARIA',          perfil: 'professor'    },
  { nome: 'LILIAN DAS GRAÇAS DA SILVA NEVES',                perfil: 'professor'    },
  { nome: 'PEDRO DINIZ SILVEIRA DAS NEVES',                  perfil: 'professor'    },
  { nome: 'LUCIMAR DE OLIVEIRA SANTOS',                      perfil: 'professor'    },
  { nome: 'MARIA APARECIDA GOMES FRANCISCO',                 perfil: 'professor'    },
  { nome: 'RODOLFO JESUS DO PRADO FILHO',                    perfil: 'professor'    },
  // Secretaria de Escola
  { nome: 'ROSEMARY ALVES FERREIRA ANDRADE EUGÊNIO',         perfil: 'professor'    },
  // Gerente de Organização Escolar
  { nome: 'VANESSA OSÓRIO VENTURA',                          perfil: 'professor'    },
];

async function seed() {
  await db.inicializar();
  console.log('\n🌱 Criando usuários no banco...\n');
  const hash = await bcrypt.hash(SENHA_PADRAO, 10);
  let criados = 0, pulados = 0;

  for (const u of USUARIOS) {
    const existe = db.getUsuarioNome(u.nome);
    if (existe) { pulados++; continue; }
    db.inserirUsuario(u.nome, u.perfil, hash);
    console.log(`  ✅ ${u.perfil.padEnd(12)} ${u.nome}`);
    criados++;
  }

  console.log(`\n✔ ${criados} criado(s), ${pulados} já existiam.`);
  console.log(`🔑 Senha padrão: ${SENHA_PADRAO}\n`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
