import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule], // nécessaire pour <router-outlet>
  template: `<router-outlet></router-outlet>`, // le router va injecter les composants ici
})
export class AppComponent {}
