import {AfterViewInit, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {DatePipe, Location} from '@angular/common';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {AlertService} from 'src/app/core/services/alert.service';
import {CustomValidators} from '../../../form-validator/custom-validators';
import {ExceptionsService} from '../../../../../core/services/exceptions.service';
import {ScannerService} from '../../../../../core/services/scanner.service';
import {IScanner} from '../../../../../core/entities/IScanner';
import {ICluster} from '../../../../../core/entities/ICluster';
import {ClusterService} from '../../../../../core/services/cluster.service';
import {PolicyService} from '../../../../../core/services/policy.service';
import {IPolicy} from '../../../../../core/entities/IPolicy';
import {NamespaceService} from '../../../../../core/services/namespace.service';
import {INamespace} from '../../../../../core/entities/INamespace';
import {IException} from '../../../../../core/entities/IException';
import {forkJoin, Observable, of, Subject} from 'rxjs';
import {IGateKeeperConstraintDetails} from '../../../../../core/entities/IGateKeeperConstraint';
import {GateKeeperService} from '../../../../../core/services/gate-keeper.service';
import {VulnerabilitySeverity} from '../../../../../core/enum/VulnerabilitySeverity';
import {take, takeUntil} from 'rxjs/operators';
import {CustomValidatorService} from '../../../../../core/services/custom-validator.service';

@Component({
  selector: 'exception-create',
  templateUrl: './exception-create.component.html',
  styleUrls: ['./exception-create.component.scss']
})
export class ExceptionCreateComponent implements OnInit, AfterViewInit, OnDestroy {
  protected unsubscribe$ = new Subject<void>();

  exceptionForm: FormGroup;
  subMenuTitle: string;
  editMode: boolean;
  exceptionId: number;

  origException: IException;
  scanners: IScanner[];
  policies: IPolicy[];
  clusters: ICluster[];
  namespaces: INamespace[];
  namespacesToBeDisplayed: INamespace[];

  scannersLoaded = false;
  policiesLoaded = false;
  clustersLoaded = false;
  namespacesLoaded = false;

  origSelectedPolicies: string[];
  origSelectedClusters: string[];
  origSelectedNamespaces: string[];

  gatekeeperConstraintList: Observable<IGateKeeperConstraintDetails[]> = of([]);
  filteredGatekeeperConstraints: Observable<IGateKeeperConstraintDetails[]>;

  @ViewChild('issueIdentifierLabel') issueIdentifierLabel;
  loading = false;
  submitButtonText = 'Submit';

  severityLevels = [ VulnerabilitySeverity.NEGLIGIBLE,
                    VulnerabilitySeverity.LOW,
                    VulnerabilitySeverity.MEDIUM,
                    VulnerabilitySeverity.MAJOR,
                    VulnerabilitySeverity.CRITICAL];

  constructor(
    private exceptionsService: ExceptionsService,
    private formBuilder: FormBuilder,
    private alertService: AlertService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private scannerService: ScannerService,
    private policyService: PolicyService,
    private clusterService: ClusterService,
    private namespaceService: NamespaceService,
    private datePipe: DatePipe,
    protected customValidatorService: CustomValidatorService,
    private gateKeeperService: GateKeeperService) {

    const getCurrentUrl = this.router.url;
    this.editMode = getCurrentUrl.split('/').reverse()[0] === 'edit';
    if (this.editMode){
      this.submitButtonText = 'Update';
    }

    this.exceptionForm = this.formBuilder.group({
      title: ['', [CustomValidators.requiredNoTrim, Validators.maxLength(255)]],
      reason: ['', []],
      issueIdentifier: ['', [Validators.maxLength(255), Validators.required]],
      startDate: [new Date(),
        {
          validators: [Validators.required, CustomValidators.checkForCurrentDate()],
          updateOn: 'blur'
        }],
      endDate: ['', {
        validators: [],
      }],
      status: ['', [Validators.required]],
      scannerId: [''],
      policies: ['', Validators.nullValidator],
      clusters: [''],
      namespaces: [''],
      type: [''],
      imageMatch: ['', [this.customValidatorService.regex]],
      altSeverity: ['', [Validators.required]]
    },
      {
      validators: [CustomValidators.checkEndDateIsGreaterThanStartDate()],
      updateOn: 'blur'
    }
    );

    this.exceptionForm.controls.type.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: val => this.changeTypeSelection(val)
      });
    if (this.editMode) {
      this.exceptionForm.controls.startDate.setValidators(null);
      this.subMenuTitle = 'Edit Exception';
    } else {
      this.exceptionForm.controls.policies.disable();
      this.subMenuTitle = 'Create Exception';
    }

    // Will be triggered iin edit mode because population of the data happens in ngAftetrViewInit
    this.exceptionForm.controls.type.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (newVal: string) => {
          if (newVal === 'override') {
            this.exceptionForm.controls.altSeverity.setValidators([Validators.required]);
          } else {
            this.exceptionForm.controls.altSeverity.clearValidators();
          }
          this.exceptionForm.controls.altSeverity.updateValueAndValidity();
        }
      });
  }

  ngOnInit(): void {
    this.route.params.pipe(take(1))
      .subscribe({
        next: params => {
          this.exceptionId = params.id;
          if (!this.exceptionId && this.editMode) {
            this.editMode = false;
            this.subMenuTitle = 'Create Exception';
            this.alertService.danger('Exception Could not be retrieved. Please try again later.');
          }
        }
      });

    this.scannerService.getAllScanners()
      .pipe(take(1))
      .subscribe({
        next: val => {this.scanners = val.data; this.scannersLoaded = true; }
      });
    this.policyService.getAllPolicies()
      .pipe(take(1))
      .subscribe({
        next: val => {
          this.policies = val.data.list;
          this.policiesLoaded = true;
        }
      });
    this.clusterService.getAllClusters()
      .pipe(take(1))
      .subscribe({
        next: val => {
          this.clusters = val.data;
          this.clustersLoaded = true;
        }
      });
    this.namespaceService.getCurrentK8sNamespaces()
      .pipe(take(1))
      .subscribe({
        next: val => {
          this.namespaces = val.data;
          this.namespacesToBeDisplayed = val.data;
          this.namespacesLoaded = true;
        }
      });

    if (this.editMode) {
      this.exceptionsService.getExceptionById(this.exceptionId)
        .pipe(take(1))
        .subscribe({
          next:  response => {
            this.origException = response.data[0];
            this.populateData();
            this.disableAllExceptionTypeFields();
            },
          error: _ => {
            this.alertService.danger('Exception could not be retrieved. Please try again later');
            this.exceptionId = null;
          }
        });
    }
    this.issueIdentifier.valueChanges
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: changedValue => {
          this._filter(changedValue);
        }
      });
  }

  ngAfterViewInit(){
    this.route.queryParams
      .pipe(take(1))
      .subscribe({
        next: params => {
          const namespaceSet = new Set(params.namespaces);
          const namespaces = Array.from(namespaceSet);
          const namespacesMappedWithClusterId = namespaces.map(n => `${n}:${params.clusterId}`);
          if (Object.keys(params).length > 0) {
            this.issueIdentifier.setValue(params.cve);
            this.exceptionForm.controls.type.setValue('policy');
            this.exceptionForm.controls.policies.enable();
            this.exceptionForm.controls.clusters.setValue([params.clusterId]);
            this.loadNamespacesForSelectedClusters([params.clusterId], true);
            this.exceptionForm.controls.scannerId.setValue(params.scannerId);
            this.exceptionForm.controls.policies.setValue(params.policyIds);
            this.exceptionForm.controls.namespaces.setValue(namespacesMappedWithClusterId);
            this.exceptionForm.controls.status.setValue('review');
            this.exceptionForm.controls.imageMatch.setValue(params.imageName);
            this.exceptionForm.controls.title.setValue(`Requesting Exception for ${params.cve} in ${params.imageName} of ${namespaces.join(',')}`);
          }
        }
      });
  }

  populateData() {
    this.exceptionForm.controls.title.reset(this.origException.title);
    this.issueIdentifier.reset(this.origException.issueIdentifier);
    this.exceptionForm.controls.reason.reset(this.origException.reason);
    this.exceptionForm.controls.status.reset(this.origException.status);
    /*
      https://stackoverflow.com/questions/35651517/angular-ui-datepicker-is-getting-wrong-date
    */
    const modifiedDate = new Date(this.origException.startDate);
    this.exceptionForm.controls.startDate.reset(new Date(modifiedDate.getTime() + modifiedDate.getTimezoneOffset() * 60000));
    this.exceptionForm.controls.startDate.setValidators(CustomValidators.checkForCurrentDate(true, this.origException.startDate));
    this.exceptionForm.controls.endDate.reset(this.origException.endDate);
    this.exceptionForm.controls.type.setValue(this.origException.type);
    // Will help passively clean up legacy exceptions as exceptions are edited
    const matchValue = this.origException.imageMatch === '%' ? '' : this.origException.imageMatch;
    this.exceptionForm.controls.imageMatch.setValue(matchValue);

    this.origSelectedPolicies = this.origException.policies.map(p => p.id.toString());
    this.exceptionForm.controls.policies.setValue(this.origSelectedPolicies);

    this.origSelectedClusters = this.origException.clusters.map(c => c.id.toString());
    this.exceptionForm.controls.clusters.setValue(this.origSelectedClusters);
    this.loadNamespacesForSelectedClusters(this.origSelectedClusters);

    this.origSelectedNamespaces = this.origException.namespaces.map(n => n.name);
    this.exceptionForm.controls.namespaces.setValue(this.setNamespacesForSelectedClusters(this.origSelectedNamespaces));

    if (this.origException.type === 'gatekeeper') {
      if (this.origException.clusters.length > 0) {
        this.loadGatekeeperConstraints(this.origException.clusters.map(cluster => String(cluster.id)));
      }
    }
    this.exceptionForm.controls.altSeverity.setValue(this.origException.altSeverity);
  }

  onSubmit() {
    this.enableSpinner();
    const data = this.exceptionForm.getRawValue();
    data.startDate = this.datePipe.transform(data.startDate, 'yyyy-MM-dd');
    if (data.endDate) {
      data.endDate = this.datePipe.transform(data.endDate, 'yyyy-MM-dd');
    }
    if (data.namespaces.length) {
      data.namespaces = data.namespaces.map(n => n.split(':')[0]);
      data.namespaces = new Set(data.namespaces);
      data.namespaces = Array.from(data.namespaces);
    }
    data.imageMatch = data.imageMatch === '' ? '%' : data.imageMatch ;
    if (this.editMode) {
      data.isTempException = this.origException.isTempException;
      this.submitButtonText = 'Updating...';
      this.exceptionsService.updateExceptionById(data, this.exceptionId)
        .pipe(take(1))
        .subscribe({
          next: response => {
            this.disableSpinner();
            this.router.navigate(['private', 'exceptions', response.data.id]);
            this.alertService.success('Exception updated');
            },
          error: err => this.handleApiError(err)
        });
    } else {
      this.submitButtonText = 'Submitting...';
      this.exceptionsService.createException(data)
        .pipe(take(1))
        .subscribe({
          next: response => {
            this.router.navigate(['private', 'exceptions', response.data.id]);
            this.alertService.success('Exception created');
            },
          error: err => this.handleApiError(err)
        });
    }
  }

  handleApiError(err) {
    let msg = 'Something went wrong, please try again later.';
    if (err.status && err.status === 400) { msg = err.error?.message || msg; }
    this.disableSpinner();
    if (this.editMode) {
      this.submitButtonText = 'Update';
    } else {
      this.submitButtonText = 'Submit';
    }
    this.alertService.danger(msg);
  }

  cancel() {
    this.location.back();
  }

  get startDate(){
    return this.exceptionForm.controls.startDate;
  }

  changeTypeSelection(newType: string) {
    this.exceptionForm.controls.policies.disable();
    switch (newType){
      case 'policy':
        this.exceptionForm.controls.policies.enable();
        this.changeCVELabel('Issue (CVE Code)');
        this.setIssueIdentifierRequired(false);
        this.gatekeeperConstraintList = of([]);
        break;
      case 'gatekeeper':
        this.exceptionForm.controls.policies.disable();
        this.changeCVELabel('Issue (Constraint Template Name)');
        const getSelectedClusters = this.exceptionForm.controls.clusters.value;
        if (getSelectedClusters instanceof Array && getSelectedClusters.length > 0) {
          this.loadGatekeeperConstraints(getSelectedClusters);
        }
        this.setIssueIdentifierRequired(true);
        break;
      case 'override':
        this.exceptionForm.controls.policies.enable();
        this.changeCVELabel('Issue (CVE Type Code)');
        this.issueIdentifier.markAsUntouched();
        this.gatekeeperConstraintList = of([]);
        this.setIssueIdentifierRequired(false);
        break;
    }
  }

  disableAllExceptionTypeFields(){
    const getExceptionType = this.origException.type;
    if (getExceptionType === 'gatekeeper') {
      this.exceptionForm.controls.policies.disable();
    }
  }

  changeCVELabel(labelText: string){
    this.issueIdentifierLabel.nativeElement.innerText = labelText;
  }

  get issueIdentifier(){
    return this.exceptionForm.controls.issueIdentifier;
  }

  setIssueIdentifierRequired(required: boolean): void {
    this.issueIdentifier.clearValidators();
    this.issueIdentifier.addValidators([Validators.maxLength(255)]);
    if (required) {
      this.issueIdentifier.addValidators([Validators.required]);
    }
    this.issueIdentifier.updateValueAndValidity();
  }

  onClusterChange($event){
    this.loadNamespacesForSelectedClusters($event.value);
    if (this.exceptionForm.controls.type.value === 'policy') {
      this.gatekeeperConstraintList = of([]);
    }
    else {
      this.loadGatekeeperConstraints($event.value);
    }
  }

  private loadGatekeeperConstraints(clusters: string[]) {
     const constraints$: Observable<any> = forkJoin(
        clusters.map(clusterId => this.gateKeeperService.getGateKeeperConstraintTemplatesByCluster(+clusterId))
      );
     constraints$.pipe(take(1)).subscribe({
       next: data => {
         const filteredData = data.filter(d => d.length > 0);
         const flattenData = filteredData.flat();
         const constraints: IGateKeeperConstraintDetails[] = flattenData;
         this.gatekeeperConstraintList = of(constraints);
         this.filteredGatekeeperConstraints = this.gatekeeperConstraintList;
       }
     });
    }

  private _filter(params: string) {
    this.gatekeeperConstraintList
      .pipe(take(1))
      .subscribe({
        next: data => {
          const filteredData = data.filter(d => d.metadata.name.toLowerCase().match(params.toLowerCase()) !== null);
          this.filteredGatekeeperConstraints = of(filteredData);
        }
      });
  }

  private enableSpinner() {
    this.loading = true;
  }

  private disableSpinner() {
    this.loading = false;
  }

  private loadNamespacesForSelectedClusters(selectedClusters: string[], requestException = false) {
    if (requestException) {
      this.namespaceService.getCurrentK8sNamespaces()
        .pipe(take(1))
        .subscribe({
          next: val => {
            this.namespaces = val.data;
            this.namespacesLoaded = true;
            const selectedClustersToNumber = selectedClusters.map(v => Number(v));
            this.namespacesToBeDisplayed = this.namespaces.filter(n => selectedClustersToNumber.includes(n.clusterId));
          }
        });

    } else {
      if (selectedClusters.length) {
        const selectedClustersToNumber = selectedClusters.map(v => Number(v));
        this.namespacesToBeDisplayed = this.namespaces.filter(n => selectedClustersToNumber.includes(n.clusterId));
        if (this.exceptionForm.value.namespaces.length) {
          const getSelectedNamespaces = this.exceptionForm.value.namespaces;
          const namespacesToBeDisplayedNames = this.namespacesToBeDisplayed.map(n => `${n.name}:${n.clusterId}`);
          const getFilteredNamespaces = getSelectedNamespaces.filter(n => namespacesToBeDisplayedNames.includes(n));
          this.exceptionForm.controls.namespaces.setValue(getFilteredNamespaces);
        }
      } else {
        this.namespacesToBeDisplayed = this.namespaces;
      }

    }
  }

  private setNamespacesForSelectedClusters(namespaces: string[]){
    const modifiedNamespaces = [];
    if (namespaces.length) {
      for (const n of this.namespacesToBeDisplayed) {
        if (namespaces.includes(n.name)){
          modifiedNamespaces.push(`${n.name}:${n.clusterId}`);
        }
      }
    }
    return modifiedNamespaces;
  }

  formatNamespaceDisplay() {
    let namespaces = this.exceptionForm.value.namespaces;
    if (namespaces.length) {
      namespaces = namespaces.map(n => n.split(':')[0]);
      return namespaces.join(', ');
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
