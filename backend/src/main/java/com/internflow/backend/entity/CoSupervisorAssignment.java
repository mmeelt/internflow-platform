package com.internflow.backend.entity;
import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name="co_supervisor_assignments", uniqueConstraints=@UniqueConstraint(columnNames={"internship_id","supervisor_id"}))
public class CoSupervisorAssignment {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="internship_id",nullable=false) private Internship internship;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="supervisor_id",nullable=false) private User supervisor;
 @Column(nullable=false) private String status="pending"; @Column(name="created_at",updatable=false) private Instant createdAt=Instant.now();
 public Long getId(){return id;} public Internship getInternship(){return internship;} public void setInternship(Internship v){internship=v;} public User getSupervisor(){return supervisor;} public void setSupervisor(User v){supervisor=v;} public String getStatus(){return status;} public void setStatus(String v){status=v;} public Instant getCreatedAt(){return createdAt;}
}
