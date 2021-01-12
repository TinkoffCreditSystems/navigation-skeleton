import {CommonModule} from '@angular/common';
import {Component, Inject, Injectable, InjectionToken, NgModule} from '@angular/core';
import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {CanActivate, Resolve, Router, RouterModule} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {NEVER, Observable, Subject, timer} from 'rxjs';
import {mapTo} from 'rxjs/operators';
import {anything, instance, mock, when} from 'ts-mockito';

import {
    NavigationSkeletonComponent,
    NavigationSkeletonRoute,
} from './navigation-skeleton.component';

@Component({
    selector: 'test-routing',
    template: `<tcs-navigation-skeleton>projected-content</tcs-navigation-skeleton>`,
})
class TestRoutingComponent {}

@Injectable()
export class TestRoutingResolve implements Resolve<any> {
    resolve(): Observable<any> {
        return timer(0);
    }
}

@Injectable()
export class TestRoutingCanActivate implements CanActivate {
    canActivate(): Observable<boolean> {
        return timer(0).pipe(mapTo(true));
    }
}

@Component({
    selector: 'test',
    template: '',
})
class TestComponent {}

const TEST_SKELETON_DEPENDENCY = new InjectionToken<string>('[TEST] Skeleton dependency');

@Component({
    selector: 'test-skeleton-1',
    template: 'test-skeleton-1 with {{ dependency }}',
})
class TestSkeleton1Component {
    constructor(@Inject(TEST_SKELETON_DEPENDENCY) public readonly dependency: string) {}
}

@Component({
    selector: 'test-skeleton-2',
    template: 'test-skeleton-2 with {{ dependency }}',
})
class TestSkeleton2Component {
    constructor(@Inject(TEST_SKELETON_DEPENDENCY) public readonly dependency: string) {}
}

@Component({
    selector: 'fin-test-lazy',
    template: '',
})
class TestLazyComponent {}

@Component({
    selector: 'test-skeleton-lazy',
    template: 'test-skeleton-lazy with {{ dependency }}',
})
class TestSkeletonLazyComponent {
    constructor(@Inject(TEST_SKELETON_DEPENDENCY) public readonly dependency: string) {}
}

@NgModule({
    imports: [
        RouterModule.forChild([
            {
                path: '2',
                component: TestLazyComponent,
                skeleton: {
                    component: TestSkeletonLazyComponent,
                },
                resolve: {
                    test: TestRoutingResolve,
                },
            },
        ] as NavigationSkeletonRoute[]),
    ],
    declarations: [TestLazyComponent, TestSkeletonLazyComponent],
    providers: [
        {
            provide: TEST_SKELETON_DEPENDENCY,
            useValue: 'dependency from lazy module',
        },
    ],
})
export class TestSkeletonLazyModule {}

describe('NavigationSkeletonService | Сервис для регистрации скелетон компонентов в реестре', () => {
    let resolveMock: Resolve<any>;
    let canActivateMock: CanActivate;

    let routes: NavigationSkeletonRoute[] = [];

    let router: Router;
    let fixture: ComponentFixture<TestRoutingComponent>;

    beforeEach(() => {
        resolveMock = mock(TestRoutingResolve);
        canActivateMock = mock(TestRoutingCanActivate);

        routes = [
            {
                path: '1',
                component: TestComponent,
                skeleton: {
                    component: TestSkeleton1Component,
                },
                canActivate: [TestRoutingCanActivate],
            },
            {
                path: '2',
                component: TestComponent,
                skeleton: {
                    component: TestSkeleton2Component,
                },
                resolve: {
                    test: TestRoutingResolve,
                },
            },
            {
                path: '3',
                canActivate: [TestRoutingCanActivate],
                loadChildren: () => TestSkeletonLazyModule,
            },
            {
                path: '4',
                component: TestComponent,
                canActivate: [TestRoutingCanActivate],
            },
            {
                path: '5',
                canActivate: [TestRoutingCanActivate],
                loadChildren: () => TestSkeletonLazyModule,
            },
        ];
    });

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                CommonModule,
                RouterTestingModule.withRoutes(routes),
                NoopAnimationsModule,
            ],
            declarations: [
                TestRoutingComponent,
                TestComponent,
                TestSkeleton1Component,
                TestSkeleton2Component,
                NavigationSkeletonComponent,
            ],
            providers: [
                {provide: TestRoutingResolve, useFactory: () => instance(resolveMock)},
                {
                    provide: TestRoutingCanActivate,
                    useFactory: () => instance(canActivateMock),
                },
                {
                    provide: TEST_SKELETON_DEPENDENCY,
                    useValue: 'dependency from parent module',
                },
            ],
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(TestRoutingComponent);
        router = TestBed.get(Router);

        fixture.detectChanges();
    });

    describe('Если у целевого роута есть скелетон компонент', () => {
        it('Скелетон компонент должен браться из целевого роута', fakeAsync(() => {
            // arrange
            when(canActivateMock.canActivate(anything(), anything())).thenReturn(NEVER);

            // act
            router.navigateByUrl('/3/2');
            tick();
            fixture.detectChanges();

            // assert
            expect(fixture.debugElement.nativeElement.textContent).toBe(
                'test-skeleton-lazy with dependency from lazy module',
            );
        }));

        it('Скелетон компонент можно переиспользовать', fakeAsync(() => {
            // arrange
            const canActivate = new Subject<boolean>();

            when(canActivateMock.canActivate(anything(), anything())).thenReturn(
                canActivate,
            );

            // act
            router.navigateByUrl('/3/2');
            tick();
            canActivate.next(true);
            fixture.detectChanges();

            router.navigateByUrl('/5/2');
            tick();
            fixture.detectChanges();

            // assert
            expect(fixture.debugElement.nativeElement.textContent).toBe(
                'test-skeleton-lazy with dependency from lazy module',
            );
        }));

        it('В процессе активация роута, показывается скелетон компонент роута', fakeAsync(() => {
            // arrange
            when(canActivateMock.canActivate(anything(), anything())).thenReturn(NEVER);

            // act
            router.navigateByUrl('/1');
            tick();
            fixture.detectChanges();

            // assert
            expect(fixture.debugElement.nativeElement.textContent).toBe(
                'test-skeleton-1 with dependency from parent module',
            );
        }));

        it('После активации роута, показывается переданный контент', fakeAsync(() => {
            // arrange
            when(canActivateMock.canActivate(anything(), anything())).thenReturn(true);

            // act
            router.navigateByUrl('/1');
            tick();
            fixture.detectChanges();

            // assert
            expect(fixture.debugElement.nativeElement.textContent).toBe(
                'projected-content',
            );
        }));

        it('В процессе резолва данных роута, показывается скелетон компонент роута', fakeAsync(() => {
            // arrange
            when(resolveMock.resolve(anything(), anything())).thenReturn(NEVER);

            // act
            router.navigateByUrl('/2');
            tick();
            fixture.detectChanges();

            // assert
            expect(fixture.debugElement.nativeElement.textContent).toBe(
                'test-skeleton-2 with dependency from parent module',
            );
        }));

        it('После резолва данных роута, показывается переданный контент', fakeAsync(() => {
            // arrange
            when(resolveMock.resolve(anything(), anything())).thenReturn('data');

            // act
            router.navigateByUrl('/2');
            tick();
            fixture.detectChanges();

            // assert
            expect(fixture.debugElement.nativeElement.textContent).toBe(
                'projected-content',
            );
        }));
    });

    it('Если у целевого роута нет скелетон компонента, то показывается переданный контент', fakeAsync(() => {
        // arrange
        when(canActivateMock.canActivate(anything(), anything())).thenReturn(NEVER);

        // act
        router.navigateByUrl('/4');
        tick();
        fixture.detectChanges();

        // assert
        expect(fixture.debugElement.nativeElement.textContent).toBe('projected-content');
    }));
});