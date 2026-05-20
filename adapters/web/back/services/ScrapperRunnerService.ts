import ScrapperMassive, { type ScrapperProvider, type ScrapperOpts } from '../../../../engine/scrapper/ScrapperMassive.ts';

export interface ScrapperState {
    status: 'idle' | 'running' | 'error';
    provider: string | null;
    progress: { step: string; current: number; total: number };
    error: string | null;
    startedAt: string | null;
    finishedAt: string | null;
}

class ScrapperRunnerService {
    private state: ScrapperState = {
        status: 'idle',
        provider: null,
        progress: { step: '', current: 0, total: 0 },
        error: null,
        startedAt: null,
        finishedAt: null,
    };

    private stopSignal = { stopped: false };

    getStatus(): ScrapperState {
        return { ...this.state, progress: { ...this.state.progress } };
    }

    isRunning(): boolean {
        return this.state.status === 'running';
    }

    start(provider: ScrapperProvider | 'all', opts: ScrapperOpts = {}): void {
        if (this.state.status === 'running') {
            throw new Error('Le scrapper est déjà en cours d\'exécution');
        }

        this.stopSignal = { stopped: false };
        this.state = {
            status: 'running',
            provider,
            progress: { step: 'Démarrage...', current: 0, total: 0 },
            error: null,
            startedAt: new Date().toISOString(),
            finishedAt: null,
        };

        ScrapperMassive.scrapProvider(
            provider,
            opts,
            (step, current, total) => {
                this.state.progress = { step, current, total };
            },
            this.stopSignal
        ).then(() => {
            this.state.status = 'idle';
            this.state.finishedAt = new Date().toISOString();
            this.state.progress.step = 'Terminé';
        }).catch(err => {
            this.state.status = 'error';
            this.state.error = err.message ?? String(err);
            this.state.finishedAt = new Date().toISOString();
        });
    }

    stop(): void {
        this.stopSignal.stopped = true;
        if (this.state.status === 'running') {
            this.state.progress.step = 'Arrêt en cours...';
        }
    }
}

export default new ScrapperRunnerService();
