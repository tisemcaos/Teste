// ============================================
// NOVA FONTE DE DADOS: RSS DO GLOBO ESPORTE (GRATUITO E CONFIÁVEL)
// ============================================
const RSS_URL = 'https://corsproxy.io/?' + encodeURIComponent('https://globoesporte.globo.com/rss/globo-esporte/futebol/brasileirao-serie-a/');

// ============================================
// CLASSE DA API
// ============================================
class FootballAPI {
    async fetchData(url) {
        console.log('🔍 Buscando:', url);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            const text = await response.text();
            return text;
        } catch (error) {
            console.error('❌ Erro na requisição:', error);
            throw error;
        }
    }

    parseXML(xmlString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        return xmlDoc;
    }

    extractMatchesFromNews(xmlDoc) {
        const items = xmlDoc.querySelectorAll('item');
        const matches = [];

        items.forEach(item => {
            const title = item.querySelector('title')?.textContent || '';
            const description = item.querySelector('description')?.textContent || '';
            const link = item.querySelector('link')?.textContent || '';
            const pubDate = item.querySelector('pubDate')?.textContent || '';

            // Tenta extrair informações de jogos a partir do título e descrição
            const matchInfo = this.parseMatchTitle(title, description);
            if (matchInfo) {
                matches.push({
                    ...matchInfo,
                    link,
                    pubDate,
                    description
                });
            }
        });

        return matches;
    }

    parseMatchTitle(title, description) {
        // Remove tags HTML
        const cleanDescription = description.replace(/<[^>]*>/g, '');
        
        // Procura por padrões de placar (ex: "2 x 1", "3x1")
        const scoreRegex = /(\d+)\s*x\s*(\d+)/i;
        const scoreMatch = title.match(scoreRegex) || cleanDescription.match(scoreRegex);
        
        if (scoreMatch) {
            const parts = title.split(scoreRegex);
            const teamPart = parts[0].trim();
            
            // Tenta separar os times
            const teams = teamPart.split(/vs|contra|enfrenta/i);
            if (teams.length >= 2) {
                return {
                    time1: teams[0].trim(),
                    time2: teams[1].trim(),
                    placar1: parseInt(scoreMatch[1]),
                    placar2: parseInt(scoreMatch[2]),
                    status: 'Finalizado'
                };
            }
        }
        
        // Se não tem placar, pode ser um jogo que ainda vai acontecer
        const upcomingRegex = /(\w[\w\s]+?)\s+(?:pega|enfrenta|vs|contra|recebe)\s+(\w[\w\s]+)/i;
        const upcomingMatch = title.match(upcomingRegex) || cleanDescription.match(upcomingRegex);
        
        if (upcomingMatch) {
            return {
                time1: upcomingMatch[1].trim(),
                time2: upcomingMatch[2].trim(),
                placar1: null,
                placar2: null,
                status: 'Agendado'
            };
        }
        
        return null;
    }

    async getMatches() {
        const xmlString = await this.fetchData(RSS_URL);
        const xmlDoc = this.parseXML(xmlString);
        const matches = this.extractMatchesFromNews(xmlDoc);
        
        console.log('📊 Partidas encontradas:', matches.length);
        return matches;
    }
}

// ============================================
// CLASSE DA INTERFACE (Mantida a mesma estrutura)
// ============================================
class UI {
    constructor() {
        this.container = document.getElementById('jogosContainer');
        this.loading = document.getElementById('loadingSkeleton');
        this.emptyState = document.getElementById('emptyState');
        this.searchInput = document.getElementById('searchInput');
        this.tabs = document.querySelectorAll('.tab');
        this.currentTab = 'hoje';
        this.matchesFromAPI = [];
        this.displayedMatches = [];
        
        this.initEvents();
    }

    initEvents() {
        this.searchInput.addEventListener('input', () => this.filterAndRender());
        
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.currentTab = tab.dataset.tab;
                this.tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.applyTabFilter();
                this.filterAndRender();
            });
        });

        window.addEventListener('scroll', () => {
            const fab = document.querySelector('.fab');
            if (fab) fab.style.display = window.scrollY > 300 ? 'block' : 'none';
        });
    }

    showLoading() {
        if (this.loading) this.loading.style.display = 'block';
        if (this.container) this.container.innerHTML = '';
        if (this.emptyState) this.emptyState.style.display = 'none';
    }

    hideLoading() {
        if (this.loading) this.loading.style.display = 'none';
    }

    showError(message) {
        if (this.container) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle" style="color: #ff7675; font-size: 3em;"></i>
                    <h3>Erro ao carregar dados</h3>
                    <p>${message}</p>
                    <button onclick="atualizarJogos()" style="margin-top:15px;padding:10px 20px;background:var(--primary);border:none;border-radius:10px;color:white;cursor:pointer;">Tentar Novamente</button>
                </div>`;
        }
    }

    showEmpty() {
        if (this.emptyState) this.emptyState.style.display = 'block';
        if (this.container) this.container.innerHTML = '';
    }

    async loadData() {
        this.showLoading();
        console.log('🚀 Iniciando carregamento dos dados...');
        
        try {
            this.matchesFromAPI = await api.getMatches();
            console.log('📊 Total de jogos processados:', this.matchesFromAPI.length);
            
            this.applyTabFilter();
            this.filterAndRender();
        } catch (error) {
            console.error('💥 Erro:', error);
            this.showError('Não foi possível conectar. Tente novamente.');
        } finally {
            this.hideLoading();
        }
    }

    applyTabFilter() {
        const hoje = new Date().toISOString().split('T')[0];
        
        switch (this.currentTab) {
            case 'hoje':
                // Filtra jogos publicados nas últimas 24 horas
                const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
                this.displayedMatches = this.matchesFromAPI.filter(m => {
                    const pubDate = new Date(m.pubDate);
                    return pubDate >= ontem;
                });
                break;
                
            case 'proximos':
                // Jogos agendados (sem placar)
                this.displayedMatches = this.matchesFromAPI.filter(m => 
                    m.status === 'Agendado'
                );
                break;
                
            case 'todos':
            default:
                this.displayedMatches = [...this.matchesFromAPI];
                break;
        }
        
        console.log('🔢 Jogos após filtro:', this.displayedMatches.length);
    }

    filterAndRender() {
        let filtered = [...this.displayedMatches];
        
        const search = this.searchInput.value.toLowerCase();
        if (search) {
            filtered = filtered.filter(m => {
                const team1 = (m.time1 || '').toLowerCase();
                const team2 = (m.time2 || '').toLowerCase();
                return team1.includes(search) || team2.includes(search);
            });
        }

        this.renderMatches(filtered);
    }

    renderMatches(matches) {
        if (!this.container) return;
        this.container.innerHTML = '';
        
        if (!matches || matches.length === 0) {
            this.showEmpty();
            return;
        }

        this.container.innerHTML = `<h3 style="color:var(--primary);margin-bottom:15px;">⚽ Jogos Encontrados (${matches.length})</h3>`;
        
        matches.forEach(m => {
            this.container.appendChild(this.createCard(m));
        });

        if (this.emptyState) this.emptyState.style.display = 'none';
    }

    createCard(match) {
        const isFinished = match.status === 'Finalizado';
        const hasScore = match.placar1 !== null && match.placar2 !== null;
        const score = hasScore ? `${match.placar1} - ${match.placar2}` : 'VS';
        const statusText = isFinished ? 'Finalizado' : 'Agendado';
        const statusClass = isFinished ? 'status-finished' : 'status-scheduled';
        const date = new Date(match.pubDate || Date.now());
        const dateStr = date.toLocaleDateString('pt-BR');
        const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        const card = document.createElement('div');
        card.className = 'match-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="league-info">
                    <span class="league-name">Brasileirão Série A</span>
                </div>
                <span class="match-status ${statusClass}">${statusText}</span>
            </div>
            <div class="match-content">
                <div class="team">
                    <div class="team-name">${match.time1}</div>
                </div>
                <div class="score">
                    <span class="${!hasScore ? 'score-vs' : ''}">${score}</span>
                </div>
                <div class="team">
                    <div class="team-name">${match.time2}</div>
                </div>
            </div>
            <div class="card-footer">
                <span><i class="far fa-calendar-alt"></i> ${dateStr} às ${timeStr}</span>
                <a href="${match.link}" target="_blank" style="color:var(--primary);text-decoration:none;">Ver mais</a>
            </div>
        `;
        return card;
    }
}

// ============================================
// APLICAÇÃO PRINCIPAL
// ============================================
class App {
    constructor() {
        const hoje = new Date().toISOString().split('T')[0];
        this.currentDate = hoje;
        
        const dataInput = document.getElementById('dataFiltro');
        if (dataInput) dataInput.value = hoje;
    }

    init() {
        console.log('🏁 App iniciado');
        ui.loadData();
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================
const api = new FootballAPI();
const ui = new UI();
const app = new App();

window.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM carregado, iniciando app...');
    app.init();
});

// ============================================
// FUNÇÕES GLOBAIS
// ============================================
function atualizarJogos() {
    console.log('🔄 Atualizando jogos...');
    ui.loadData();
}

function buscarPorData() {
    ui.loadData();
}

function buscarHoje() {
    ui.loadData();
}
