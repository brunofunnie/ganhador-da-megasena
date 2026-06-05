import { computeStatistics } from './statistics';

interface Strategy {
  id: string;
  nome: string;
  descricao: string;
}

interface StrategyResult {
  estrategia: Strategy;
  jogos: string[][];
}

const STRATEGIES: Strategy[] = [
  { id: 'top6', nome: 'Top 6 Históricos', descricao: 'Os 6 números mais sorteados de todos os tempos' },
  { id: 'cold6', nome: 'Atrasados 6', descricao: 'Os 6 números que não saem há mais tempo' },
  { id: 'balanced-3p3i', nome: '3P-3I Equilibrado', descricao: '3 pares + 3 ímpares mais frequentes de cada categoria' },
  { id: 'quadrants', nome: 'Quadrantes', descricao: 'Pelo menos 1 número de cada quadrante (1-15, 16-30, 31-45, 46-60)' },
  { id: 'full-cycle', nome: 'Ciclo Completo', descricao: '10 jogos cobrindo todos os 60 números' },
  { id: 'sum-target', nome: 'Soma Alvo', descricao: 'Combinações com soma no intervalo 170-190' },
  { id: 'primes-power', nome: 'Primos Power', descricao: 'Prioriza números primos com boa frequência' },
  { id: 'avg-frequency', nome: 'Frequência Média', descricao: 'Números com frequência próxima da média' },
];

export function getStrategies(): Strategy[] {
  return STRATEGIES;
}

export function executeStrategy(strategyId: string): StrategyResult {
  const strategy = STRATEGIES.find(s => s.id === strategyId);
  if (!strategy) throw new Error(`Estratégia não encontrada: ${strategyId}`);

  const stats = computeStatistics();

  let jogos: string[][] = [];

  switch (strategyId) {
    case 'top6': {
      jogos = [stats.frequency.slice(0, 6).map(f => f.numero)];
      break;
    }

    case 'cold6': {
      jogos = [stats.coldNumbers.slice(0, 6).map(c => c.numero)];
      break;
    }

    case 'balanced-3p3i': {
      const evens = stats.frequency.filter(f => parseInt(f.numero) % 2 === 0);
      const odds = stats.frequency.filter(f => parseInt(f.numero) % 2 !== 0);
      jogos = [[...evens.slice(0, 3).map(f => f.numero), ...odds.slice(0, 3).map(f => f.numero)]];
      break;
    }

    case 'quadrants': {
      const nums = stats.frequency.slice(0, 12).map(f => parseInt(f.numero));
      const q = [
        nums.filter(n => n >= 1 && n <= 15),
        nums.filter(n => n >= 16 && n <= 30),
        nums.filter(n => n >= 31 && n <= 45),
        nums.filter(n => n >= 46 && n <= 60),
      ];
      const pick = [
        (q[0][0] || q[1][0] || q[2][0] || q[3][0]).toString().padStart(2, '0'),
        (q[1][0] || q[2][0] || q[3][0] || q[0][0]).toString().padStart(2, '0'),
        (q[2][0] || q[3][0] || q[0][0] || q[1][0]).toString().padStart(2, '0'),
        (q[3][0] || q[0][0] || q[1][0] || q[2][0]).toString().padStart(2, '0'),
      ];
      const rest = stats.frequency
        .filter(f => !pick.includes(f.numero))
        .slice(0, 2)
        .map(f => f.numero);
      jogos = [[...pick, ...rest].slice(0, 6)];
      break;
    }

    case 'full-cycle': {
      const all = Array.from({ length: 60 }, (_, i) =>
        (i + 1).toString().padStart(2, '0')
      );
      for (let g = 0; g < 10; g++) {
        jogos.push(all.slice(g * 6, g * 6 + 6));
      }
      break;
    }

    case 'sum-target': {
      const pool = stats.frequency.slice(0, 30).map(f => parseInt(f.numero));
      let found = false;
      for (let attempt = 0; attempt < 1000 && !found; attempt++) {
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const candidate = shuffled.slice(0, 6);
        const sum = candidate.reduce((a, b) => a + b, 0);
        if (sum >= 170 && sum <= 190) {
          jogos = [candidate.map(n => n.toString().padStart(2, '0')).sort()];
          found = true;
        }
      }
      if (!found) {
        jogos = [stats.frequency.slice(0, 6).map(f => f.numero)];
      }
      break;
    }

    case 'primes-power': {
      const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59]);
      const primeNums = stats.frequency.filter(f => primes.has(parseInt(f.numero)));
      const nonPrime = stats.frequency.filter(f => !primes.has(parseInt(f.numero)));
      jogos = [[
        ...primeNums.slice(0, 4).map(f => f.numero),
        ...nonPrime.slice(0, 2).map(f => f.numero)
      ]];
      break;
    }

    case 'avg-frequency': {
      const avg = stats.frequency.reduce((sum, f) => sum + f.frequencia, 0) / stats.frequency.length;
      const closest = [...stats.frequency]
        .sort((a, b) =>
          Math.abs(a.frequencia - avg) - Math.abs(b.frequencia - avg)
        );
      jogos = [closest.slice(0, 6).map(f => f.numero)];
      break;
    }
  }

  for (const jogo of jogos) {
    jogo.sort((a, b) => parseInt(a) - parseInt(b));
  }

  return { estrategia: strategy, jogos };
}
