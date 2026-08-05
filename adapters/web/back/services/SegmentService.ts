import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type SegmentCleanMode = 'clean' | 'clean-all';

/**
 * Intégration du sous-module Python `segmentai` (détection Opening/Ending +
 * génération de MKV avec chapitres). Le sous-module n'est présent que si
 * l'utilisateur a fait `git submodule update --init` ; on détecte donc sa
 * disponibilité via la présence de `chapterize.py`.
 */
class SegmentService {
    // services/ -> ../modules/segmentai
    private moduleDir = path.resolve(__dirname, '../modules/segmentai');
    private entryPoint = path.join(this.moduleDir, 'chapterize.py');

    /** Le sous-module a-t-il été initialisé ? */
    isAvailable(): boolean {
        return fs.existsSync(this.entryPoint);
    }

    getModuleDir(): string {
        return this.moduleDir;
    }

    /** Option activée par l'utilisateur (persistée dans le .env). */
    isEnabled(): boolean {
        return process.env.SEGMENT_EPISODES === 'true';
    }

    getCleanMode(): SegmentCleanMode {
        return process.env.SEGMENT_CLEAN_MODE === 'clean-all' ? 'clean-all' : 'clean';
    }

    /**
     * Interpréteur Python : le venv du module en priorité (torch/torchaudio/
     * panns y sont installés), sinon le python du PATH.
     */
    getPythonExecutable(): string {
        const venv = process.platform === 'win32'
            ? path.join(this.moduleDir, '.venv', 'Scripts', 'python.exe')
            : path.join(this.moduleDir, '.venv', 'bin', 'python');
        if (fs.existsSync(venv)) return venv;
        return process.platform === 'win32' ? 'python' : 'python3';
    }

    /**
     * Arguments pour `chapterize.py` sur un dossier de saison. Les MKV sont
     * écrits dans le dossier de la saison lui-même pour que Jellyfin les voie.
     */
    buildArgs(seasonFolder: string, mode: SegmentCleanMode): string[] {
        return [
            'chapterize.py',
            seasonFolder,
            '--ext', '.mp4',
            '--out', seasonFolder,
            mode === 'clean-all' ? '--clean-all' : '--clean',
        ];
    }
}

export default new SegmentService();
